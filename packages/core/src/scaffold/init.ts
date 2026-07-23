/**
 * `keel init` and `keel run new` — the two commands that put structure on disk.
 *
 * Both are idempotent and **never overwrite**. That rule is what makes it honest to say Keel does
 * not author content (M6): it can add an empty form where none existed, and it can do nothing else.
 */

import { existsSync } from "node:fs";
import { lstat, mkdir, readdir, readFile, stat, symlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { KeelError } from "../model/errors.js";
import { isKebabName } from "../model/ids.js";
import { assertSafeRepoPath } from "../model/paths.js";

export interface ScaffoldResult {
  written: string[];
  skipped: string[];
}

const HERE = dirname(fileURLToPath(import.meta.url));

/** Both shipped bundles (`templates`, `agent`) live at the same three candidate layouts. */
function resolveAssetsDir(bundle: string): string {
  const candidates = [
    join(HERE, "..", "..", "assets", bundle),
    join(HERE, "..", "..", "core", "assets", bundle),
    join(HERE, "..", "core", "assets", bundle),
  ];
  for (const candidate of candidates) {
    if (existsSync(join(candidate, bundle === "templates" ? "VERSION" : "AGENTS.md"))) {
      return candidate;
    }
  }
  return candidates[0];
}

/** Templates ship with the package; resolved safely across source and bundle locations. */
export const DEFAULT_ASSETS = resolveAssetsDir("templates");

/** The agent operating context (AGENTS.md, workflow/, principles.md, …) ships the same way. */
export const DEFAULT_AGENT_ASSETS = resolveAssetsDir("agent");

const CLAUDE_SETTINGS = ".claude/settings.json";
const COMMIT_HOOK = ".git/hooks/prepare-commit-msg";
const SEC_GUARD_HOOK = ".git/hooks/pre-push";

/** Which gate each phase skill may not run before. */
export const PHASE_GATE_MATCHERS: { skill: string; gate: string }[] = [
  { skill: "hld", gate: "G1" },
  { skill: "stack", gate: "G2" },
  { skill: "lld", gate: "G3" },
  { skill: "spec-check", gate: "G4" },
  { skill: "tasks", gate: "G5" },
  { skill: "implement", gate: "G5" },
];

/**
 * The agent operating context, directory by directory. Source names avoid a leading dot (the
 * shipped bundle is otherwise a plain, dot-free tree, same as `assets/templates`) — the two
 * `.claude/*` subtrees are named plainly in the bundle and mapped to their dotted destination here.
 */
const AGENT_CONTEXT_DIRS: { src: string; dest: string }[] = [
  { src: "workflow", dest: "workflow" },
  { src: "profiles", dest: "profiles" },
  { src: "tools", dest: "tools" },
  { src: "skills", dest: "skills" },
  { src: "claude-commands", dest: ".claude/commands" },
  { src: "claude-agents", dest: ".claude/agents" },
];

/** One known file per agent-context directory — `keel doctor` samples these, not a full walk. */
export const AGENT_CONTEXT_SAMPLE_FILES: string[] = [
  "AGENTS.md",
  "principles.md",
  "workflow/lifecycle.md",
  "profiles/README.md",
  "tools/diagrams.md",
  "skills/README.md",
  ".claude/commands/kickoff.md",
  ".claude/agents/reviewer.md",
];

export async function init(args: {
  repoRoot: string;
  assetsDir?: string;
  agentAssetsDir?: string;
  /** Scaffold the agent operating context (AGENTS.md, workflow/, …) — on by default (M1: agent-first). */
  agentContext?: boolean;
}): Promise<ScaffoldResult> {
  const {
    repoRoot,
    assetsDir = DEFAULT_ASSETS,
    agentAssetsDir = DEFAULT_AGENT_ASSETS,
    agentContext = true,
  } = args;
  const result: ScaffoldResult = { written: [], skipped: [] };

  const templatesVersion = (await readAsset(assetsDir, "VERSION")).trim();

  await write(repoRoot, "keel.yaml", manifestFor(templatesVersion), result);

  for (const name of await readdir(assetsDir)) {
    await write(repoRoot, join("templates", name), await readAsset(assetsDir, name), result);
  }

  await writeClaudeSettings(repoRoot, result);
  await write(repoRoot, COMMIT_HOOK, commitHookScript(), result, 0o755);
  await write(repoRoot, SEC_GUARD_HOOK, secGuardHookScript(), result, 0o755);

  if (agentContext) {
    await write(repoRoot, "AGENTS.md", await readAsset(agentAssetsDir, "AGENTS.md"), result);
    await writeSymlink(repoRoot, "CLAUDE.md", "AGENTS.md", result);
    await writeSymlink(repoRoot, "GEMINI.md", "AGENTS.md", result);
    await write(
      repoRoot,
      "principles.md",
      await readAsset(agentAssetsDir, "principles.md"),
      result,
    );

    for (const { src, dest } of AGENT_CONTEXT_DIRS) {
      await copyTree(repoRoot, join(agentAssetsDir, src), dest, result);
    }
  }

  return result;
}

export async function createRun(args: {
  repoRoot: string;
  name: string;
  specsDir?: string;
}): Promise<ScaffoldResult> {
  const { repoRoot, name, specsDir = "specs" } = args;

  if (!isKebabName(name)) {
    throw new KeelError({
      code: "ENV_BAD_ROOT",
      message: `"${name}" is not a valid run name.`,
      nextAction: "Use lower-case words joined by single dashes, e.g. checkout-v2.",
    });
  }

  const dir = assertSafeRepoPath(repoRoot, join(specsDir, name));
  if (await exists(join(repoRoot, dir))) {
    throw new KeelError({
      code: "ENV_BAD_ROOT",
      message: `${dir} already exists.`,
      nextAction: `Pick another run name, or continue the existing run with: keel status --run ${name}`,
      path: dir,
    });
  }

  const result: ScaffoldResult = { written: [], skipped: [] };
  await write(repoRoot, join(dir, "context.md"), contextFor(name), result);
  await write(repoRoot, join(dir, "STATUS.md"), statusFor(name), result);
  return result;
}

// ---------------------------------------------------------------------------
// file writing — the never-overwrite rule lives here
// ---------------------------------------------------------------------------

async function write(
  repoRoot: string,
  path: string,
  contents: string,
  result: ScaffoldResult,
  mode?: number,
): Promise<void> {
  const safePath = assertSafeRepoPath(repoRoot, path);
  const absolute = join(repoRoot, safePath);

  if (await exists(absolute)) {
    result.skipped.push(safePath);
    return;
  }

  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, contents, mode !== undefined ? { mode } : "utf8");
  result.written.push(safePath);
}

async function exists(absolute: string): Promise<boolean> {
  return stat(absolute).then(
    () => true,
    () => false,
  );
}

/** `lstat`, not `stat` — a broken symlink must still count as "exists" so it is never overwritten. */
async function existsAsLink(absolute: string): Promise<boolean> {
  return lstat(absolute).then(
    () => true,
    () => false,
  );
}

/**
 * A relative symlink (`CLAUDE.md` → `AGENTS.md`), same as this repo's own root. `targetName` is
 * resolved relative to `path`'s own directory, so both must live at the same directory level.
 *
 * Falls back to a plain copy of the target's content on any failure (e.g. Windows without
 * dev-mode privilege — symlink creation there requires elevation, and this project doesn't
 * otherwise support Windows yet) — CLAUDE.md/GEMINI.md must be readable either way.
 */
async function writeSymlink(
  repoRoot: string,
  path: string,
  targetName: string,
  result: ScaffoldResult,
): Promise<void> {
  const safePath = assertSafeRepoPath(repoRoot, path);
  const absolute = join(repoRoot, safePath);

  if (await existsAsLink(absolute)) {
    result.skipped.push(safePath);
    return;
  }

  await mkdir(dirname(absolute), { recursive: true });
  try {
    await symlink(targetName, absolute);
  } catch {
    const contents = await readFile(join(dirname(absolute), targetName), "utf8");
    await writeFile(absolute, contents, "utf8");
  }
  result.written.push(safePath);
}

/**
 * Recursively copies a shipped bundle subtree into the repo, file by file, through `write()`.
 * Unlike a user's own repository tree (which legitimately may not have a given directory), this
 * walks Keel's *own* shipped assets — a missing subtree here is a broken installation, not an
 * absent optional thing, so it fails loudly the same way `readAsset` does for a missing file.
 */
async function copyTree(
  repoRoot: string,
  sourceDir: string,
  destDir: string,
  result: ScaffoldResult,
): Promise<void> {
  async function walk(dir: string, rel: string): Promise<void> {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      throw new KeelError({
        code: "ENV_UNREADABLE",
        message: `Shipped asset directory ${dir} is missing from this installation.`,
        nextAction: "Reinstall @keel-dev/cli.",
        path: dir,
      });
    }
    for (const entry of entries) {
      const name = String(entry.name);
      const childRel = rel ? `${rel}/${name}` : name;
      if (entry.isDirectory()) {
        await walk(join(dir, name), childRel);
      } else {
        const contents = await readFile(join(dir, name), "utf8");
        await write(repoRoot, join(destDir, childRel), contents, result);
      }
    }
  }

  await walk(sourceDir, "");
}

async function readAsset(assetsDir: string, name: string): Promise<string> {
  try {
    return await readFile(join(assetsDir, name), "utf8");
  } catch {
    throw new KeelError({
      code: "ENV_UNREADABLE",
      message: `Shipped asset ${name} is missing from this installation.`,
      nextAction: "Reinstall @keel-dev/cli.",
      path: join(assetsDir, name),
    });
  }
}

/**
 * Claude Code settings are the user's file, so matchers are merged in rather than written over.
 * Unparseable JSON is left strictly alone and reported.
 */
async function writeClaudeSettings(repoRoot: string, result: ScaffoldResult): Promise<void> {
  const absolute = join(repoRoot, CLAUDE_SETTINGS);

  let settings: Record<string, unknown> = {};
  if (await exists(absolute)) {
    try {
      settings = JSON.parse(await readFile(absolute, "utf8")) as Record<string, unknown>;
    } catch {
      result.skipped.push(`${CLAUDE_SETTINGS} (not valid JSON — left untouched)`);
      return;
    }
  }

  const hooks = (settings.hooks ?? {}) as Record<string, unknown>;
  const existing = Array.isArray(hooks.PreToolUse) ? (hooks.PreToolUse as unknown[]) : [];
  const serialised = JSON.stringify(existing);

  const additions = PHASE_GATE_MATCHERS.filter(
    ({ skill }) => !serialised.includes(`Skill(${skill})`),
  ).map(({ skill, gate }) => ({
    matcher: `Skill(${skill})`,
    hooks: [{ type: "command", command: `keel check --require ${gate} --format agent` }],
  }));

  if (additions.length === 0) {
    result.skipped.push(CLAUDE_SETTINGS);
    return;
  }

  settings.hooks = { ...hooks, PreToolUse: [...existing, ...additions] };
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  result.written.push(CLAUDE_SETTINGS);
}

// ---------------------------------------------------------------------------
// file contents
// ---------------------------------------------------------------------------

function manifestFor(templatesVersion: string): string {
  return `schema: 2\ntemplates_version: ${templatesVersion}\nspecs_dir: specs\ntelemetry: off\n`;
}

function contextFor(name: string): string {
  return `---
artifact: context
phase: 0
gate: "—"
status: set
updated: ${today()}
schema_version: 2
---

# Run Context — ${name}

- **Mode:** <new project (greenfield) | feature or change in an existing codebase>
- **Time budget:** <ample → standard path | tight → fast path>
- **Rigor profile:** <prototype | standard | production>
- **Overrides:** <none>

**Problem (one line):** <the problem this run solves>
`;
}

function statusFor(name: string): string {
  return `# Run Status — ${name}


## Now
<!-- DERIVED by keel status — do not hand-edit. -->

- **Phase:** 0 / 8 — Kickoff
- **Gates:** G1 — · G2 — · G3 — · G4 — · G5 — · G6 —
- **Tasks:** 0 / 0 done
- **Next action:** Draft requirements, confirm them, then run: keel gate pass G1 --run ${name}

## Session log
<!-- Append-only, newest on top. -->

### ${today()} — run created
- **Did:** created the run
- **Next:** frame the problem in context.md, then draft requirements
`;
}

/**
 * The attribution hook (D6). Values the environment does not supply are omitted, never invented —
 * an absent trailer is honest, a guessed one poisons the dataset it exists to create.
 */
function commitHookScript(): string {
  return `#!/bin/sh
# Installed by keel init. Appends agent attribution trailers when the environment supplies them.
# A value that is not set is omitted — never invented.
MSG_FILE="$1"

append() {
  [ -n "$2" ] && ! grep -q "^$1:" "$MSG_FILE" && printf '%s: %s\\n' "$1" "$2" >> "$MSG_FILE"
}

# Only add a trailer block if at least one value is present.
if [ -n "$KEEL_AGENT_MODEL$KEEL_AGENT_SESSION$KEEL_AGENT_TOOL$KEEL_RUN$KEEL_TASK" ]; then
  printf '\\n' >> "$MSG_FILE"
  append "Keel-Run" "$KEEL_RUN"
  append "Keel-Task" "$KEEL_TASK"
  append "Agent-Tool" "$KEEL_AGENT_TOOL"
  append "Agent-Model" "$KEEL_AGENT_MODEL"
  append "Agent-Session" "$KEEL_AGENT_SESSION"
fi

# A hook that exits non-zero aborts the commit. The last append above returns non-zero whenever
# its value was empty, so end deliberately clean — never block a commit over a missing trailer.
exit 0
`;
}

/**
 * The version is pinned deliberately, for the same reason the GitHub Action pins
 * @keel-dev/cli (packages/action/action.yml): an unpinned `npx <pkg>` always fetches whatever is
 * newest on npm, which turns every push into an unreviewed supply-chain trust decision. Bump this
 * by hand on every keel-sec-guard release.
 */
const SEC_GUARD_VERSION = "1.0.0";

function secGuardHookScript(): string {
  return `#!/bin/sh
# Installed by keel init. Runs a local security audit before pushing code to origin.

# --branch names the base branch keel-sec-guard diffs against, not the branch being pushed.
# Prefer the remote's actual default branch; fall back to keel-sec-guard's own default ("main")
# when there is no origin yet (e.g. a brand-new local repo) rather than guessing a name.
BASE_BRANCH="$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's@^origin/@@')"
BASE_BRANCH="\${BASE_BRANCH:-main}"

npx --yes keel-sec-guard@${SEC_GUARD_VERSION} audit --branch "$BASE_BRANCH" --fail-on HIGH
`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
