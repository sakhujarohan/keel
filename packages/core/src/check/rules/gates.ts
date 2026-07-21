/**
 * Rules that read gate state: is the work in the right order, was the ground confirmed before it
 * was built on, and does every seal still hold.
 */

import type { Gate } from "../../model/types.js";
import { defineRule, type Finding, finding, type Rule } from "../catalog.js";

/** The gate an artifact may not exist before. */
const REQUIRES_SEALED: {
  artifact: "hld" | "stack" | "lld" | "specCheck" | "tasks";
  upstream: Gate;
}[] = [
  { artifact: "hld", upstream: "G1" },
  { artifact: "stack", upstream: "G2" },
  { artifact: "lld", upstream: "G3" },
  { artifact: "specCheck", upstream: "G4" },
  { artifact: "tasks", upstream: "G5" },
];

function sealedGates(statuses: { gate: Gate; seal: { kind: string } }[]): Set<Gate> {
  return new Set(statuses.filter((s) => s.seal.kind === "sealed").map((s) => s.gate));
}

/** KC-02 — the Prime Directive, mechanised: no design before requirements, no code before design. */
export const kc02 = defineRule({
  id: "KC-02",
  description: "No artifact exists whose upstream gate is unsealed",
  evaluate(ctx) {
    const findings: Finding[] = [];

    for (const run of ctx.model.runs) {
      const statuses = ctx.gates.get(run.name) ?? [];
      const sealed = sealedGates(statuses);

      for (const { artifact, upstream } of REQUIRES_SEALED) {
        if (sealed.has(upstream)) continue;

        const docs =
          artifact === "hld"
            ? [run.hld]
            : artifact === "stack"
              ? [run.stack]
              : run.features.map((feature) => feature[artifact]);

        for (const doc of docs) {
          if (!doc) continue;
          findings.push(
            finding({
              rule: "KC-02",
              path: doc.path,
              message: `${doc.path} exists while ${upstream} is not sealed — confirm ${upstream} with your human, then run: keel gate pass ${upstream} --run ${run.name}`,
            }),
          );
        }
      }
    }

    return findings;
  },
});

/** KC-03 — an unconfirmed assumption under a signed G1 is the Silent-assumption anti-pattern. */
export const kc03 = defineRule({
  id: "KC-03",
  description: "No assumption is still proposed once requirements are locked",
  evaluate(ctx) {
    const findings: Finding[] = [];

    for (const run of ctx.model.runs) {
      const requirements = run.requirements;
      if (!requirements) continue;
      if (!sealedGates(ctx.gates.get(run.name) ?? []).has("G1")) continue;

      for (const assumption of requirements.assumptions) {
        if (assumption.status === "confirmed") continue;
        findings.push(
          finding({
            rule: "KC-03",
            path: requirements.path,
            line: assumption.line,
            message: `Assumption ${assumption.id ?? `"${assumption.text.slice(0, 40)}…"`} is still proposed although G1 is sealed — confirm it with your human, or reopen G1.`,
          }),
        );
      }
    }

    return findings;
  },
});

/**
 * KC-09 — seal integrity. Also the home of the ledger's own diagnostics: if the record of
 * sign-offs cannot be read, no seal it describes can be trusted.
 */
export const kc09 = defineRule({
  id: "KC-09",
  description: "Every sealed artifact still matches its seal, and the ledger itself is readable",
  evaluate(ctx) {
    const findings: Finding[] = [];

    if (!ctx.ledger.exists && ctx.model.manifest !== null && ctx.model.runs.length > 0) {
      findings.push(
        finding({
          rule: "KC-09",
          path: ".keel/gates.jsonl",
          message:
            ".keel/gates.jsonl is missing in an initialized repository — restore the gate ledger from git history to ensure gate integrity.",
        }),
      );
    }

    for (const diagnostic of ctx.ledger.diagnostics) {
      findings.push(
        finding({
          rule: "KC-09",
          path: diagnostic.path,
          ...(diagnostic.line !== undefined ? { line: diagnostic.line } : {}),
          message: diagnostic.message,
        }),
      );
    }

    for (const [run, statuses] of ctx.gates) {
      for (const status of statuses) {
        if (status.seal.kind === "broken") {
          const gone = status.seal.currentHash === null;
          findings.push(
            finding({
              rule: "KC-09",
              path: status.artifact,
              message: gone
                ? `${status.gate} was sealed for ${status.artifact}, which no longer exists — restore the file, or run: keel gate reopen ${status.gate} --run ${run}`
                : `${status.gate} was sealed at different content than ${status.artifact} now holds — restore the sealed content, or re-confirm with your human and run: keel gate reopen ${status.gate} --run ${run}`,
            }),
          );
        }

        if (status.blockedBy.length > 0) {
          findings.push(
            finding({
              rule: "KC-09",
              path: status.artifact,
              message: `${status.gate} cannot be trusted while ${status.blockedBy.join(", ")} ${status.blockedBy.length === 1 ? "is" : "are"} unsealed — settle the earlier gate first.`,
            }),
          );
        }
      }
    }

    return findings;
  },
});

export const gateRules: Rule[] = [kc02, kc03, kc09];
