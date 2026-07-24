/**
 * What a gate's seal is worth right now, and what that implies downstream.
 *
 * Both answers are *derived* — nothing here is ever written. Restoring an artifact to its sealed
 * bytes heals every downstream gate with no cleanup, because validity is a function of state
 * rather than of bookkeeping (ADR 0002).
 */

import type { Gate } from "../model/types.js";
import { FEATURE_GATES, featureOfArtifact, GATE_ORDER, type GateEvent } from "./event.js";
import type { LedgerView, SealKey } from "./ledger.js";

export type SealState =
  | { kind: "unsealed" }
  | { kind: "sealed"; entry: GateEvent }
  /** Content drifted since sealing. `currentHash` is null when the artifact is gone. */
  | { kind: "broken"; entry: GateEvent; currentHash: string | null }
  | { kind: "reopened"; entry: GateEvent };

export interface GateStatus {
  gate: Gate;
  artifact: string;
  seal: SealState;
  /** Earlier gates not standing on solid ground. Empty ⇒ this gate is trustworthy. */
  blockedBy: Gate[];
}

export function sealStateFor(args: {
  key: SealKey;
  view: LedgerView;
  currentHash: string | null;
}): SealState {
  const latest = args.view.latestFor(args.key);
  if (!latest) return { kind: "unsealed" };
  if (latest.event === "reopen") return { kind: "reopened", entry: latest };

  if (args.currentHash === null) return { kind: "broken", entry: latest, currentHash: null };
  if (args.currentHash === latest.artifact_hash) return { kind: "sealed", entry: latest };
  return { kind: "broken", entry: latest, currentHash: args.currentHash };
}

/**
 * Every gate the ledger knows about for a run, with downstream invalidation derived from gate
 * order. Run-level gates block everything after them; a per-feature gate (G4, G5) only blocks
 * later gates *of the same feature*, so one feature's unfinished design never stalls another's.
 */
export function gateStatuses(args: {
  run: string;
  view: LedgerView;
  hashes: Map<string, string | null>;
}): GateStatus[] {
  const { run, view, hashes } = args;

  const statuses = view.keysFor(run).map((key) => ({
    gate: key.gate,
    artifact: key.artifact,
    seal: sealStateFor({ key, view, currentHash: hashes.get(key.artifact) ?? null }),
    blockedBy: [] as Gate[],
  }));

  const isSealed = (status: GateStatus) => status.seal.kind === "sealed";

  for (const status of statuses) {
    const feature = featureOfArtifact(status.artifact);
    const earlier = GATE_ORDER.slice(0, GATE_ORDER.indexOf(status.gate));

    status.blockedBy = earlier.filter((gate) => {
      const relevant = statuses.filter((candidate) => {
        if (candidate.gate !== gate) return false;
        if (!FEATURE_GATES.includes(gate)) return true;
        // A feature-scoped predecessor (G4/G5) is judged two ways. If the dependent gate belongs
        // to a feature, only that feature's instance matters. If the dependent is run-level (G6,
        // which has no feature), it rests on *every* feature's instance being sealed — so a
        // run-level gate never blocks itself merely for not matching a feature.
        return feature === null || featureOfArtifact(candidate.artifact) === feature;
      });

      // No record at all counts as not sealed — but only for gates that should exist. A run-level
      // gate is not blocked by a feature gate that no feature ever reached.
      if (relevant.length === 0) return FEATURE_GATES.includes(gate) ? feature !== null : true;
      return !relevant.every(isSealed);
    });
  }

  return statuses.sort(
    (a, b) =>
      GATE_ORDER.indexOf(a.gate) - GATE_ORDER.indexOf(b.gate) ||
      a.artifact.localeCompare(b.artifact),
  );
}
