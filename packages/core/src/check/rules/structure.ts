/**
 * Rules that read the documents alone: do they parse, do they declare what they must, and does
 * every requirement reach a feature that delivers it.
 */

import { parseIdList } from "../../model/ids.js";
import { defineRule, type Finding, finding, type Rule } from "../catalog.js";

/** KC-01 — everything the loader could not make sense of surfaces here, and only here. */
export const kc01 = defineRule({
  id: "KC-01",
  description: "Artifacts and the manifest parse and validate",
  evaluate(ctx) {
    return ctx.model.diagnostics
      .filter((diagnostic) => !diagnostic.code.startsWith("ledger-"))
      .map((diagnostic) =>
        finding({
          rule: "KC-01",
          path: diagnostic.path,
          ...(diagnostic.line !== undefined ? { line: diagnostic.line } : {}),
          message: diagnostic.message,
        }),
      );
  },
});

/** KC-04 — silence about mandates is indistinguishable from having none; say which it is. */
export const kc04 = defineRule({
  id: "KC-04",
  description: "Literal Mandates are listed, or explicitly declared absent",
  evaluate(ctx) {
    const findings: Finding[] = [];
    for (const run of ctx.model.runs) {
      const requirements = run.requirements;
      if (!requirements) continue;

      if (requirements.mandates.length === 0 && !requirements.mandatesExplicitNone) {
        findings.push(
          finding({
            rule: "KC-04",
            path: requirements.path,
            message:
              'No Literal Mandates are declared — list them, or write "None" in that section to say the spec states none.',
          }),
        );
      }
    }
    return findings;
  },
});

/** KC-05 — a requirement nobody delivers is a requirement nobody will build. */
export const kc05 = defineRule({
  id: "KC-05",
  description: "Every requirement is delivered by some feature",
  evaluate(ctx) {
    const findings: Finding[] = [];

    for (const run of ctx.model.runs) {
      const requirements = run.requirements;
      const hld = run.hld;
      if (!requirements || !hld) continue;

      const delivered = new Set(hld.featureList.flatMap((feature) => feature.delivers));
      for (const requirement of requirements.requirements) {
        if (delivered.has(requirement.id)) continue;
        findings.push(
          finding({
            rule: "KC-05",
            path: hld.path,
            line: requirement.line,
            message: `${requirement.id} is not delivered by any feature — add it to a feature's Delivers column in the HLD feature list.`,
          }),
        );
      }
    }

    return findings;
  },
});

/** KC-06 — a feature the HLD promises but never designs is the gap that ships as a surprise. */
export const kc06 = defineRule({
  id: "KC-06",
  description: "Every feature the HLD declares has a low-level design",
  evaluate(ctx) {
    const findings: Finding[] = [];

    for (const run of ctx.model.runs) {
      const hld = run.hld;
      if (!hld) continue;

      for (const declared of hld.featureList) {
        const feature = run.features.find((candidate) => candidate.name === declared.name);
        if (feature?.lld) continue;
        // An explicit deferral in the row is an answer; silence is not.
        if (/\b(deferred|out of scope|not in this version)\b/i.test(declared.lldPath)) continue;

        findings.push(
          finding({
            rule: "KC-06",
            path: hld.path,
            line: declared.line,
            message: `Feature "${declared.name}" has no lld.md — design it, or mark the row deferred.`,
          }),
        );
      }
    }

    return findings;
  },
});

export const structureRules: Rule[] = [kc01, kc04, kc05, kc06];

export { parseIdList };
