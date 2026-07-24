/**
 * Running the catalog, and the narrow question a hook asks.
 *
 * `runChecks` is the whole verdict; `requireGate` answers one thing — is this gate sealed at the
 * artifact's current content — because a hook runs before every intercepted tool call and must
 * not pay for the full catalog.
 */

import { featureOfArtifact } from "../ledger/event.js";
import type { Gate } from "../model/types.js";
import type { Finding, Rule, RuleContext } from "./catalog.js";
import { buildReport, type CheckReport } from "./report.js";
import { gateRules } from "./rules/gates.js";
import { structureRules } from "./rules/structure.js";
import { traceabilityRules } from "./rules/traceability.js";

export const CATALOG: readonly Rule[] = Object.freeze(
  [...structureRules, ...gateRules, ...traceabilityRules].sort((a, b) => a.id.localeCompare(b.id)),
);

export interface CheckOptions {
  run?: string;
  /** Treat "no keel.yaml" as an error rather than a quiet pass. */
  strict?: boolean;
}

export function runChecks(ctx: RuleContext, opts: CheckOptions = {}): CheckReport {
  const notAKeelRepo =
    ctx.model.manifest === null &&
    ctx.model.diagnostics.every((diagnostic) => diagnostic.code !== "manifest-invalid");

  if (notAKeelRepo && !opts.strict) return buildReport([], true);

  const findings: Finding[] = [];
  for (const rule of CATALOG) {
    // A rule that throws must never be swallowed into a clean report: the caller turns this into
    // exit 2, so "keel is broken" can never read as "nothing is wrong".
    findings.push(...rule.evaluate(ctx));
  }

  const scoped = opts.run
    ? findings.filter((finding) => isWithinRun(finding.path, ctx, opts.run as string))
    : findings;

  return buildReport(scoped, false);
}

function isWithinRun(path: string, ctx: RuleContext, run: string): boolean {
  const entry = ctx.model.runs.find((candidate) => candidate.name === run);
  if (!entry) return false;
  return path.startsWith(`${entry.dir}/`) || path === "keel.yaml" || path === ".git";
}

/**
 * The hook path (R4). Returns a blocking finding unless the gate is sealed at the artifact's
 * current content; per-feature gates can be narrowed with `feature`.
 */
export function requireGate(args: {
  ctx: RuleContext;
  run: string;
  gate: Gate;
  feature?: string;
}): CheckReport {
  const { ctx, run, gate, feature } = args;
  const statuses = (ctx.gates.get(run) ?? []).filter((status) => {
    if (status.gate !== gate) return false;
    if (!feature) return true;
    return featureOfArtifact(status.artifact) === feature;
  });

  const scope = feature ? `${gate} for ${feature}` : gate;

  if (statuses.length === 0) {
    return buildReport([
      {
        rule: "KC-09",
        severity: "block",
        path: run,
        message: `${scope} is not sealed for ${run} — confirm it with your human, then run: keel gate pass ${gate} --run ${run}`,
      },
    ]);
  }

  const findings: Finding[] = [];
  for (const status of statuses) {
    if (status.seal.kind === "sealed" && status.blockedBy.length === 0) continue;

    const reason =
      status.seal.kind === "broken"
        ? `${status.artifact} has changed since ${gate} was sealed`
        : status.seal.kind === "reopened"
          ? `${gate} was reopened and not sealed again`
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
