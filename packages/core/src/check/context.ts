/**
 * The one impure step of a check.
 *
 * Everything a rule may read is loaded here, once, and frozen. Rules then run as pure functions,
 * which is what makes them exhaustively testable and their output stable enough to diff in CI.
 */

import type { GitAnchor } from "../anchor/git.js";
import { readLedger } from "../ledger/ledger.js";
import { type GateStatus, gateStatuses } from "../ledger/seal.js";
import { loadRunModel } from "../model/load.js";
import type { ArtifactDoc, RepoModel, RunEntry } from "../model/types.js";
import type { CommitInfo, RuleContext } from "./catalog.js";

/** How far back KC-13 looks for attribution. Deep enough to cover a feature's worth of work. */
const COMMIT_SCAN_LIMIT = 200;

export async function buildContext(args: {
  repoRoot: string;
  anchor: GitAnchor;
  needCommits?: boolean;
  runFilter?: string;
}): Promise<RuleContext> {
  const { repoRoot, anchor, needCommits = false, runFilter } = args;

  const model = await loadRunModel(repoRoot, runFilter ? { runFilter } : {});
  const ledger = await readLedger(repoRoot);

  // Hash every artifact the model knows about, plus anything the ledger has sealed — a gate can
  // reference a file that has since been deleted, and that is exactly a case we must detect.
  const paths = new Set<string>(model.runs.flatMap(artifactPathsOf));
  for (const entry of ledger.entries) paths.add(entry.artifact);
  const hashes = await anchor.hashObjects([...paths].sort());

  const gates = new Map<string, GateStatus[]>();
  for (const run of model.runs) {
    gates.set(run.name, gateStatuses({ run: run.name, view: ledger, hashes }));
  }
  // A ledger may name a run whose directory is gone; keep its gates visible so KC-09 can say so.
  for (const entry of ledger.entries) {
    if (!gates.has(entry.run)) {
      gates.set(entry.run, gateStatuses({ run: entry.run, view: ledger, hashes }));
    }
  }

  const commits: CommitInfo[] = needCommits ? await anchor.recentCommits(COMMIT_SCAN_LIMIT) : [];

  return deepFreeze({ model, ledger, hashes, gates, commits });
}

export function artifactDocsOf(run: RunEntry): ArtifactDoc[] {
  const docs: (ArtifactDoc | undefined)[] = [
    run.context,
    run.requirements,
    run.hld,
    run.stack,
    run.conventions,
    run.review,
  ];
  for (const feature of run.features) {
    docs.push(feature.lld, feature.specCheck, feature.tasks);
  }
  return docs.filter((doc): doc is ArtifactDoc => doc !== undefined);
}

export function artifactPathsOf(run: RunEntry): string[] {
  return artifactDocsOf(run).map((doc) => doc.path);
}

/** Rules must not be able to scribble on their own inputs, even by accident. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

export type { RepoModel };
