/**
 * `keel upgrade` — bring a v1 repository up to schema v2 without touching a word of the prose.
 *
 * v1 kept gate state in `status: signed-off` frontmatter and had no ledger. Upgrade writes the
 * manifest, bumps `schema_version`, and backfills a ledger entry for every signed-off artifact —
 * marked `legacy: true`, because Keel records that the sign-off is *claimed*, not that it witnessed
 * it (N5). The hash and commit are real, computed now; only the sign-off event is historical.
 */

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { GitAnchor } from "../anchor/git.js";
import { GateRefusal } from "../gate/refusal.js";
import { type GateEvent, LEDGER_PATH } from "../ledger/event.js";
import { appendGateEvent, keyOf, readLedger } from "../ledger/ledger.js";
import { DEFAULT_SPECS_DIR, MANIFEST_FILENAME, parseManifest } from "../model/manifest.js";
import type { Gate } from "../model/types.js";
import { DEFAULT_ASSETS } from "../scaffold/init.js";

export interface UpgradeResult {
  manifestWritten: boolean;
  artifactsMigrated: string[];
  ledgerBackfilled: number;
  skipped: string[];
}

const SCHEMA_LINE = /^schema_version:[ \t]*.*$/m;
const STATUS_LINE = /^status:[ \t]*(\S+)/m;
const GATE_LINE = /^gate:[ \t]*"?(G[1-6])"?/m;
const ARTIFACT_FILES = new Set([
  "context.md",
  "requirements.md",
  "hld.md",
  "stack.md",
  "conventions.md",
  "lld.md",
  "spec-check.md",
  "tasks.md",
  "review-checklist.md",
]);

export async function upgrade(args: {
  repoRoot: string;
  anchor: GitAnchor;
  assetsDir?: string;
  now?: () => Date;
}): Promise<UpgradeResult> {
  const { repoRoot, anchor, assetsDir = DEFAULT_ASSETS } = args;
  const result: UpgradeResult = {
    manifestWritten: false,
    artifactsMigrated: [],
    ledgerBackfilled: 0,
    skipped: [],
  };

  // A migration touches many files; refuse unless it can land as one reviewable diff (M8).
  await assertReadyToMigrate(anchor);

  const commit = (await anchor.headCommit()) as string; // non-null after the guard
  const actor = (await anchor.identity()) as string;

  const specsDir = await writeManifest({ repoRoot, assetsDir, result });
  const artifacts = await findArtifacts(join(repoRoot, specsDir), specsDir);

  // Bump frontmatter first, so the hash a legacy entry seals is the v2 content on disk.
  for (const path of artifacts) {
    await bumpSchemaVersion({ repoRoot, path, result });
  }

  await backfillLedger({ repoRoot, anchor, artifacts, commit, actor, result, now: args.now });

  return result;
}

async function assertReadyToMigrate(anchor: GitAnchor): Promise<void> {
  if (!(await anchor.isRepository())) {
    throw new GateRefusal({
      reason: "not-a-repository",
      message: "Not a git repository, so a migration has nothing to anchor its seals to.",
      nextAction: "Run keel upgrade from inside a git repository.",
    });
  }
  if ((await anchor.headCommit()) === null) {
    throw new GateRefusal({
      reason: "no-commit",
      message: "This repository has no commits yet.",
      nextAction: "Make an initial commit, then run keel upgrade.",
    });
  }
  if ((await anchor.identity()) === null) {
    throw new GateRefusal({
      reason: "no-identity",
      message: "git has no identity configured, so backfilled sign-offs would have no actor.",
      nextAction: 'Run: git config user.name "Your Name" && git config user.email you@example.com',
    });
  }
  const tree = await anchor.treeStatus();
  if (!tree.clean) {
    throw new GateRefusal({
      reason: "dirty-tree",
      message: `Working tree is dirty — a migration must land as one reviewable diff. Uncommitted: ${tree.dirtyPaths.join(", ")}`,
      nextAction: "Commit or stash your changes, then run keel upgrade.",
      dirtyPaths: tree.dirtyPaths,
    });
  }
}

async function writeManifest(args: {
  repoRoot: string;
  assetsDir: string;
  result: UpgradeResult;
}): Promise<string> {
  const { repoRoot, assetsDir, result } = args;
  const absolute = join(repoRoot, MANIFEST_FILENAME);

  const existing = await readMaybe(absolute);
  const { manifest } = parseManifest(existing);
  if (manifest) {
    result.skipped.push(`${MANIFEST_FILENAME} (already schema ${manifest.schema})`);
    return manifest.specsDir;
  }

  const version = (await readFile(join(assetsDir, "VERSION"), "utf8")).trim();
  await writeFile(
    absolute,
    `schema: 2\ntemplates_version: ${version}\nspecs_dir: ${DEFAULT_SPECS_DIR}\ntelemetry: off\n`,
    "utf8",
  );
  result.manifestWritten = true;
  return DEFAULT_SPECS_DIR;
}

async function findArtifacts(specsAbsolute: string, specsDir: string): Promise<string[]> {
  const found: string[] = [];

  async function walk(dir: string, rel: string): Promise<void> {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const name = String(entry.name);
      const childRel = `${rel}/${name}`;
      if (entry.isDirectory()) {
        await walk(join(dir, name), childRel);
      } else if (ARTIFACT_FILES.has(name)) {
        found.push(childRel);
      }
    }
  }

  await walk(specsAbsolute, specsDir);
  return found.sort();
}

async function bumpSchemaVersion(args: {
  repoRoot: string;
  path: string;
  result: UpgradeResult;
}): Promise<void> {
  const { repoRoot, path, result } = args;
  const absolute = join(repoRoot, path);
  const raw = await readFile(absolute, "utf8");

  const range = frontmatterRange(raw);
  if (!range) {
    result.skipped.push(`${path} (no frontmatter)`);
    return;
  }

  const block = raw.slice(range.start, range.end);
  if (/^schema_version:[ \t]*2[ \t]*$/m.test(block)) return; // already v2

  const bumped = SCHEMA_LINE.test(block)
    ? block.replace(SCHEMA_LINE, "schema_version: 2")
    : `${block}schema_version: 2\n`; // v1 files simply lack the key
  const next = raw.slice(0, range.start) + bumped + raw.slice(range.end);

  if (next !== raw) {
    await writeFile(absolute, next, "utf8");
    result.artifactsMigrated.push(path);
  }
}

async function backfillLedger(args: {
  repoRoot: string;
  anchor: GitAnchor;
  artifacts: string[];
  commit: string;
  actor: string;
  result: UpgradeResult;
  now?: () => Date;
}): Promise<void> {
  const { repoRoot, anchor, artifacts, commit, actor, result } = args;

  const ledger = await readLedger(repoRoot);
  const ts = (args.now?.() ?? new Date()).toISOString();

  for (const path of artifacts) {
    const raw = await readFile(join(repoRoot, path), "utf8");
    const status = STATUS_LINE.exec(raw)?.[1];
    const gate = GATE_LINE.exec(raw)?.[1] as Gate | undefined;
    if (status !== "signed-off" || !gate) continue;

    const run = runOf(path);
    if (!run) continue;

    // Skip if this gate is already recorded — upgrade is idempotent.
    const already = ledger.entries.some(
      (entry) => keyOf(entry) === keyOf({ run, gate, artifact: path }),
    );
    if (already) continue;

    const hash = (await anchor.hashObjects([path])).get(path);
    if (!hash) continue;

    const entry: GateEvent = {
      run,
      gate,
      event: "pass",
      artifact: path,
      artifact_hash: hash,
      actor,
      commit,
      ts,
      legacy: true,
    };
    await appendGateEvent(repoRoot, entry);
    result.ledgerBackfilled += 1;
  }
}

/** The run a specs path belongs to: `specs/<run>/…`. */
function runOf(path: string): string | null {
  return /^[^/]+\/([^/]+)\//.exec(path)?.[1] ?? null;
}

function frontmatterRange(raw: string): { start: number; end: number } | null {
  const lines = raw.split("\n");
  if (lines[0]?.trim() !== "---") return null;
  const start = lines[0].length + 1;
  let offset = start;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim() === "---") return { start, end: offset };
    offset += line.length + 1;
  }
  return null;
}

async function readMaybe(absolute: string): Promise<string | null> {
  try {
    await stat(absolute);
    return await readFile(absolute, "utf8");
  } catch {
    return null;
  }
}

export { LEDGER_PATH };
