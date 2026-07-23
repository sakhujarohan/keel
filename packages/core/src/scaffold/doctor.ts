/**
 * `keel doctor` — read-only probes of the things that make Keel work.
 *
 * The failure this exists to catch is the worst one an enforcement tool can have: silently not
 * enforcing. A hook that was never wired reports nothing, which looks exactly like a clean run.
 */

import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import type { GitAnchor } from "../anchor/git.js";
import { LEDGER_PATH } from "../ledger/event.js";
import { readLedger } from "../ledger/ledger.js";
import { MANIFEST_FILENAME, parseManifest } from "../model/manifest.js";
import { AGENT_CONTEXT_SAMPLE_FILES, PHASE_GATE_MATCHERS } from "./init.js";

const exec = promisify(execFile);

export interface Probe {
  name: string;
  ok: boolean;
  detail: string;
  /** The single next action; present only when the probe failed. */
  fix?: string;
}

export async function diagnose(args: { repoRoot: string; anchor: GitAnchor }): Promise<Probe[]> {
  const { repoRoot, anchor } = args;
  const probes: Probe[] = [];

  const isRepo = await anchor.isRepository();
  probes.push({
    name: "git repository",
    ok: isRepo,
    detail: isRepo ? "found" : "not a git repository",
    ...(isRepo
      ? {}
      : { fix: "Run keel from inside a git repository (git init for a new project)." }),
  });

  if (isRepo) {
    const identity = await anchor.identity();
    probes.push({
      name: "git identity",
      ok: identity !== null,
      detail: identity ?? "not configured",
      ...(identity
        ? {}
        : {
            fix: 'Run: git config user.name "Your Name" && git config user.email you@example.com',
          }),
    });

    const commit = await anchor.headCommit();
    probes.push({
      name: "commits",
      ok: commit !== null,
      detail: commit ? `HEAD at ${commit.slice(0, 7)}` : "no commits yet",
      ...(commit ? {} : { fix: "Make an initial commit — a seal must anchor to one." }),
    });

    const tree = await anchor.treeStatus();
    probes.push({
      name: "working tree",
      ok: true, // A dirty tree is normal; it only matters when sealing.
      detail: tree.clean ? "clean" : `${tree.dirtyPaths.length} uncommitted path(s)`,
    });
  }

  const manifestRaw = await readMaybe(join(repoRoot, MANIFEST_FILENAME));
  const { manifest, diagnostics } = parseManifest(manifestRaw);
  probes.push({
    name: "manifest",
    ok: manifest !== null,
    detail:
      manifest !== null
        ? `schema ${manifest.schema}, templates ${manifest.templatesVersion}`
        : diagnostics.length > 0
          ? "present but invalid"
          : "absent — this is not a keel repository",
    ...(manifest !== null ? {} : { fix: "Run: keel init" }),
  });

  const ledger = await readLedger(repoRoot);
  probes.push({
    name: "ledger",
    ok: ledger.diagnostics.length === 0,
    detail:
      ledger.entries.length === 0 && ledger.diagnostics.length === 0
        ? "no gates sealed yet"
        : `${ledger.entries.length} ${ledger.entries.length === 1 ? "entry" : "entries"}, ${ledger.diagnostics.length} unusable line(s)`,
    ...(ledger.diagnostics.length === 0
      ? {}
      : { fix: `Restore ${LEDGER_PATH} from git history rather than hand-editing it.` }),
  });

  probes.push(await probeHooks(repoRoot));
  probes.push(await probeKeelOnPath());
  probes.push(await probeAgentContext(repoRoot));

  return probes;
}

/**
 * The exact failure that makes a gate hook fail silently and confusingly: `.claude/settings.json`
 * runs a bare `keel check …` in a non-interactive subprocess, which never sees a shell alias or
 * rc-file function — only a real `PATH` entry resolves there. Catching it here means it surfaces
 * as a clear `keel doctor` finding instead of "command not found" the first time a phase skill runs.
 */
async function probeKeelOnPath(): Promise<Probe> {
  const finder = process.platform === "win32" ? "where" : "which";
  try {
    const { stdout } = await exec(finder, ["keel"]);
    const resolved = stdout
      .split(/\r?\n/)
      .find((line) => line.trim().length > 0)
      ?.trim();
    if (resolved) return { name: "keel on PATH", ok: true, detail: resolved };
  } catch {
    // fall through — not found, or `which`/`where` itself is unavailable
  }
  return {
    name: "keel on PATH",
    ok: false,
    detail: "not resolvable as a bare `keel` command",
    fix: "A hook runs `keel` in a non-interactive subprocess, so a shell alias won't reach it. Build and link it: npm run build && (cd packages/cli && npm link)",
  };
}

/** Missing this is the difference between an agent that knows the lifecycle and one that doesn't. */
async function probeAgentContext(repoRoot: string): Promise<Probe> {
  const present = await Promise.all(
    AGENT_CONTEXT_SAMPLE_FILES.map((path) => fileExists(join(repoRoot, path))),
  );
  const found = present.filter(Boolean).length;
  const total = AGENT_CONTEXT_SAMPLE_FILES.length;

  return {
    name: "agent context",
    ok: found === total,
    detail:
      found === 0
        ? "absent — the agent has no lifecycle awareness (AGENTS.md, workflow/, .claude/commands)"
        : `${found} of ${total} sampled files present`,
    ...(found === total ? {} : { fix: "Run: keel init" }),
  };
}

async function fileExists(absolute: string): Promise<boolean> {
  return stat(absolute).then(
    () => true,
    () => false,
  );
}

/** The probe that matters most: enforcement that is not wired is enforcement that is not happening. */
async function probeHooks(repoRoot: string): Promise<Probe> {
  const raw = await readMaybe(join(repoRoot, ".claude/settings.json"));
  if (raw === null) {
    return {
      name: "agent hooks",
      ok: false,
      detail: "no .claude/settings.json — phase skills are not gated",
      fix: "Run: keel init",
    };
  }

  let wired = 0;
  try {
    const settings = JSON.parse(raw) as Record<string, unknown>;
    const serialised = JSON.stringify(
      (settings.hooks as Record<string, unknown>)?.PreToolUse ?? [],
    );
    wired = PHASE_GATE_MATCHERS.filter(({ skill }) =>
      serialised.includes(`Skill(${skill})`),
    ).length;
  } catch {
    return {
      name: "agent hooks",
      ok: false,
      detail: ".claude/settings.json is not valid JSON",
      fix: "Fix the JSON, then run: keel init",
    };
  }

  const total = PHASE_GATE_MATCHERS.length;
  return {
    name: "agent hooks",
    ok: wired === total,
    detail: `${wired} of ${total} phase skills gated`,
    ...(wired === total ? {} : { fix: "Run: keel init (it merges, and never overwrites)" }),
  };
}

async function readMaybe(absolute: string): Promise<string | null> {
  try {
    await stat(absolute);
    return await readFile(absolute, "utf8");
  } catch {
    return null;
  }
}
