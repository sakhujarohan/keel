/**
 * `keel doctor` — read-only probes of the things that make Keel work.
 *
 * The failure this exists to catch is the worst one an enforcement tool can have: silently not
 * enforcing. A hook that was never wired reports nothing, which looks exactly like a clean run.
 */

import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { GitAnchor } from "../anchor/git.js";
import { LEDGER_PATH } from "../ledger/event.js";
import { readLedger } from "../ledger/ledger.js";
import { MANIFEST_FILENAME, parseManifest } from "../model/manifest.js";
import { PHASE_GATE_MATCHERS } from "./init.js";

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

  return probes;
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
