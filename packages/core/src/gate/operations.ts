/**
 * Sealing and reopening gates.
 *
 * `prepareSeal` gathers and validates but writes **nothing**, so the CLI can show exactly what is
 * about to be recorded and get a human's confirmation first; `commitSeal` then appends. Splitting
 * them makes "print before you write" structural rather than a habit the CLI might forget.
 */

import type { GitAnchor } from "../anchor/git.js";
import { type GateEvent, isKeelOwnedPath } from "../ledger/event.js";
import { appendGateEvent, readLedger, type SealKey } from "../ledger/ledger.js";
import type { Gate } from "../model/types.js";
import { GateRefusal } from "./refusal.js";

export interface PreparedSeal {
  /** Complete but unwritten — this is what the CLI prints for confirmation. */
  entry: GateEvent;
  /** Non-empty only when sealing over a dirty tree was explicitly allowed. */
  dirtyPaths: string[];
  priorEvent: GateEvent | undefined;
}

interface GateArgs {
  repoRoot: string;
  anchor: GitAnchor;
  run: string;
  gate: Gate;
  /** Repo-relative POSIX path of the artifact being sealed. */
  artifact: string;
  now?: () => Date;
}

export async function prepareSeal(
  args: GateArgs & { allowDirty?: boolean },
): Promise<PreparedSeal> {
  const { repoRoot, anchor, run, gate, artifact, allowDirty = false } = args;

  const context = await gatherContext({ repoRoot, anchor, artifact });
  const tree = await anchor.treeStatus();

  // Keel's own directory is exempt. Sealing writes the ledger, so counting it as dirt would mean
  // every gate after the first refused until the ledger was committed — and it is Keel's record,
  // not the artifact whose provenance this check exists to protect. (git reports the whole
  // directory as `.keel/` while it is untracked, which is why this is a prefix test.)
  const dirtyPaths = tree.dirtyPaths.filter((path) => !isKeelOwnedPath(path));
  const clean = dirtyPaths.length === 0;

  if (!clean && !allowDirty) {
    throw new GateRefusal({
      reason: "dirty-tree",
      message: `Working tree is dirty — a seal must anchor to a commit. Uncommitted: ${dirtyPaths.join(", ")}`,
      nextAction: `Commit or stash these changes, then run: keel gate pass ${gate} --run ${run}  (or pass --allow-dirty to seal anyway)`,
      dirtyPaths,
    });
  }

  const key: SealKey = { run, gate, artifact };
  const view = await readLedger(repoRoot);
  const priorEvent = view.latestFor(key);

  // Re-sealing byte-identical content would add a line that says nothing.
  if (priorEvent?.event === "pass" && priorEvent.artifact_hash === context.hash) {
    throw new GateRefusal({
      reason: "already-sealed",
      message: `${gate} is already sealed for ${artifact} at this exact content.`,
      nextAction: `Nothing to do. To record a change, edit the artifact first, or run: keel gate reopen ${gate} --run ${run}`,
    });
  }

  const entry: GateEvent = {
    run,
    gate,
    event: "pass",
    artifact,
    artifact_hash: context.hash,
    actor: context.actor,
    commit: context.commit,
    ts: timestamp(args.now),
    ...(clean ? {} : { dirty: true as const }),
  };

  return { entry, dirtyPaths, priorEvent };
}

export async function commitSeal(args: {
  repoRoot: string;
  prepared: PreparedSeal;
}): Promise<GateEvent> {
  await appendGateEvent(args.repoRoot, args.prepared.entry);
  return args.prepared.entry;
}

/** Reopening records intent; it never erases what came before. */
export async function reopenGate(args: GateArgs): Promise<GateEvent> {
  const { repoRoot, anchor, run, gate, artifact } = args;
  const context = await gatherContext({ repoRoot, anchor, artifact });

  const entry: GateEvent = {
    run,
    gate,
    event: "reopen",
    artifact,
    artifact_hash: context.hash,
    actor: context.actor,
    commit: context.commit,
    ts: timestamp(args.now),
  };

  await appendGateEvent(repoRoot, entry);
  return entry;
}

/** Everything a ledger entry needs from the environment, with a refusal for each way it can be absent. */
async function gatherContext(args: {
  repoRoot: string;
  anchor: GitAnchor;
  artifact: string;
}): Promise<{ hash: string; actor: string; commit: string }> {
  const { anchor, artifact } = args;

  if (!(await anchor.isRepository())) {
    throw new GateRefusal({
      reason: "not-a-repository",
      message: "This directory is not a git repository, so a seal has nothing to anchor to.",
      nextAction: "Run keel from inside a git repository (git init, if this is a new project).",
    });
  }

  const commit = await anchor.headCommit();
  if (commit === null) {
    throw new GateRefusal({
      reason: "no-commit",
      message:
        "This repository has no commits yet — a seal that points at no commit cannot be found later.",
      nextAction: "Make an initial commit, then seal the gate.",
    });
  }

  const actor = await anchor.identity();
  if (actor === null) {
    throw new GateRefusal({
      reason: "no-identity",
      message: "git has no identity configured, and a sign-off is worthless without one.",
      nextAction: 'Run: git config user.name "Your Name" && git config user.email you@example.com',
    });
  }

  const hash = (await anchor.hashObjects([artifact])).get(artifact) ?? null;
  if (hash === null) {
    throw new GateRefusal({
      reason: "artifact-missing",
      message: `${artifact} does not exist, so there is nothing to seal.`,
      nextAction: "Write the artifact first, then seal its gate.",
    });
  }

  return { hash, actor, commit };
}

function timestamp(now: (() => Date) | undefined): string {
  return (now?.() ?? new Date()).toISOString();
}
