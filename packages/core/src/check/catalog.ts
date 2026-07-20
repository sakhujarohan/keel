/**
 * The rule catalog — and the only place in the codebase where a severity is written.
 *
 * Mandate M4 fixes the split: KC-01…KC-09 block, KC-10…KC-13 warn. A rule reads its severity from
 * here; no call site may assign one, which is how the mandate stays true by construction.
 */

import type { LedgerView } from "../ledger/ledger.js";
import type { GateStatus } from "../ledger/seal.js";
import type { RepoModel } from "../model/types.js";

export type Severity = "block" | "warn";

export type RuleId =
  | "KC-01"
  | "KC-02"
  | "KC-03"
  | "KC-04"
  | "KC-05"
  | "KC-06"
  | "KC-07"
  | "KC-08"
  | "KC-09"
  | "KC-10"
  | "KC-11"
  | "KC-12"
  | "KC-13";

export interface Finding {
  rule: RuleId;
  severity: Severity;
  /** Repo-relative path the reader should open. */
  path: string;
  line?: number;
  /** One sentence: what is wrong, then the single next action. */
  message: string;
}

export interface CommitInfo {
  sha: string;
  subject: string;
  trailers: Record<string, string>;
  files: string[];
}

export interface RuleContext {
  readonly model: RepoModel;
  readonly ledger: LedgerView;
  /** Working-tree blob id per artifact path; null when the file is gone. */
  readonly hashes: ReadonlyMap<string, string | null>;
  /** Gate statuses keyed by run name. */
  readonly gates: ReadonlyMap<string, GateStatus[]>;
  /** Populated only when a rule in the active set needs it (KC-13). */
  readonly commits: readonly CommitInfo[];
}

export interface Rule {
  id: RuleId;
  severity: Severity;
  description: string;
  /** Pure: context in, findings out. No I/O, no clock, no git, no mutation. */
  evaluate(ctx: RuleContext): Finding[];
}

/** M4's split, as data. */
export const SEVERITIES: Readonly<Record<RuleId, Severity>> = Object.freeze({
  "KC-01": "block",
  "KC-02": "block",
  "KC-03": "block",
  "KC-04": "block",
  "KC-05": "block",
  "KC-06": "block",
  "KC-07": "block",
  "KC-08": "block",
  "KC-09": "block",
  "KC-10": "warn",
  "KC-11": "warn",
  "KC-12": "warn",
  "KC-13": "warn",
});

export const RULE_IDS = Object.keys(SEVERITIES) as RuleId[];

/** Helper every rule uses so severity is never restated at a call site. */
export function finding(args: {
  rule: RuleId;
  path: string;
  line?: number;
  message: string;
}): Finding {
  return {
    rule: args.rule,
    severity: SEVERITIES[args.rule],
    path: args.path,
    ...(args.line !== undefined ? { line: args.line } : {}),
    message: args.message,
  };
}

export function defineRule(args: {
  id: RuleId;
  description: string;
  evaluate: (ctx: RuleContext) => Finding[];
}): Rule {
  return {
    id: args.id,
    severity: SEVERITIES[args.id],
    description: args.description,
    evaluate: args.evaluate,
  };
}
