/**
 * The hook path, made as cheap as it claims to be.
 *
 * `requireGate` in engine.ts answers the right question, but only from a fully built RuleContext —
 * which parses every artifact in the repository. A PreToolUse hook pays that on *every* intercepted
 * tool call, which is how a 500 ms budget gets spent before Keel has thought about anything.
 *
 * This path reads the ledger, hashes at most a handful of files, and touches no markdown at all.
 * The ledger already records which artifact each gate was sealed against, so the model is not
 * needed to answer "is this gate sealed at its current content".
 */

import type { GitAnchor } from "../anchor/git.js";
import { featureOfArtifact, GATE_ORDER } from "../ledger/event.js";
import { readLedger } from "../ledger/ledger.js";
import { gateStatuses } from "../ledger/seal.js";
import type { Gate } from "../model/types.js";
import type { Finding } from "./catalog.js";
import { buildReport, type CheckReport } from "./report.js";

export async function requireGateFast(args: {
  repoRoot: string;
  anchor: GitAnchor;
  run: string;
  gate: Gate;
  /** Narrow to one feature for the per-feature gates G4 and G5. */
  feature?: string;
}): Promise<CheckReport> {
  const { repoRoot, anchor, run, gate, feature } = args;

  const ledger = await readLedger(repoRoot);

  // Only the artifacts this gate and its predecessors were sealed against — never the whole repo.
  const upTo = GATE_ORDER.slice(0, GATE_ORDER.indexOf(gate) + 1);
  const relevant = ledger
    .keysFor(run)
    .filter((key) => (upTo as readonly Gate[]).includes(key.gate));

  if (relevant.length === 0) {
    return buildReport([unsealed({ run, gate, feature })]);
  }

  const hashes = await anchor.hashObjects(relevant.map((key) => key.artifact).sort());
  const statuses = gateStatuses({ run, view: ledger, hashes }).filter((status) => {
    if (status.gate !== gate) return false;
    if (!feature) return true;
    return featureOfArtifact(status.artifact) === feature;
  });

  if (statuses.length === 0) {
    return buildReport([unsealed({ run, gate, feature })]);
  }

  const findings: Finding[] = [];
  for (const status of statuses) {
    if (status.seal.kind === "sealed" && status.blockedBy.length === 0) continue;

    const reason =
      status.seal.kind === "broken"
        ? status.seal.currentHash === null
          ? `${status.artifact} no longer exists, though ${gate} was sealed against it`
          : `${status.artifact} has changed since ${gate} was sealed`
        : status.seal.kind === "reopened"
          ? `${gate} was reopened and has not been sealed again`
          : status.blockedBy.length > 0
            ? `${gate} rests on ${status.blockedBy.join(", ")}, which ${status.blockedBy.length === 1 ? "is" : "are"} unsealed`
            : `${gate} is not sealed`;

    findings.push({
      rule: "KC-09",
      severity: "block",
      path: status.artifact,
      message: `${reason} — re-confirm with your human, then run: keel gate pass ${gate} --run ${run}`,
    });
  }

  return buildReport(findings);
}

function unsealed(args: { run: string; gate: Gate; feature?: string }): Finding {
  const scope = args.feature ? `${args.gate} for ${args.feature}` : args.gate;
  return {
    rule: "KC-09",
    severity: "block",
    path: args.run,
    message: `${scope} is not sealed for ${args.run} — confirm it with your human, then run: keel gate pass ${args.gate} --run ${args.run}`,
  };
}
