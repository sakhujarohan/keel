/**
 * Turning findings into a verdict.
 *
 * The exit code is computed here and nowhere else: `blocking > 0 ? 1 : 0`. Mandate M3 says the
 * check exits non-zero *if and only if* there is a block-severity finding, and keeping that
 * expression in exactly one function is what keeps the "only if" half honest.
 *
 * Environment failures are deliberately outside this range — they throw and become exit 2 — so a
 * crash can never be mistaken for either a clean run or a blocked one.
 */

import type { Finding } from "./catalog.js";

export interface CheckReport {
  findings: Finding[];
  blocking: number;
  warnings: number;
  exitCode: 0 | 1;
  /** True when there is no keel.yaml and strict mode was not requested. */
  notAKeelRepo: boolean;
}

export function buildReport(findings: Finding[], notAKeelRepo = false): CheckReport {
  const sorted = [...findings].sort(byLocation);
  const blocking = sorted.filter((f) => f.severity === "block").length;

  return {
    findings: sorted,
    blocking,
    warnings: sorted.length - blocking,
    exitCode: blocking > 0 ? 1 : 0,
    notAKeelRepo,
  };
}

/** Stable ordering so CI output diffs mean something. */
function byLocation(a: Finding, b: Finding): number {
  if (a.path !== b.path) return a.path < b.path ? -1 : 1;
  const lineA = a.line ?? 0;
  const lineB = b.line ?? 0;
  if (lineA !== lineB) return lineA - lineB;
  return a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0;
}
