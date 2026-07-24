/**
 * The ledger entry — one line of `.keel/gates.jsonl`.
 *
 * The field set is fixed by mandate M1 and is therefore **closed**: reading rejects unknown keys,
 * and writing always emits the same key order so a ledger diff reads cleanly. Per-feature gates
 * (G4, G5) are distinguished by `artifact`, not by any additional field.
 */

import { z } from "zod";
import type { Diagnostic, Gate } from "../model/types.js";

export type GateEventKind = "pass" | "reopen";

export interface GateEvent {
  run: string;
  gate: Gate;
  event: GateEventKind;
  /** Repo-relative POSIX path — this is what identifies the feature for G4 and G5. */
  artifact: string;
  artifact_hash: string;
  actor: string;
  commit: string;
  /** ISO-8601 UTC with milliseconds. Recorded for humans; never used for ordering. */
  ts: string;
  dirty?: true;
  legacy?: true;
}

export const GATE_ORDER = ["G1", "G2", "G3", "G4", "G5", "G6"] as const;

/** Gates that belong to a feature rather than the run as a whole. */
export const FEATURE_GATES: readonly Gate[] = ["G4", "G5"];

export const KEEL_DIR = ".keel";
export const LEDGER_PATH = `${KEEL_DIR}/gates.jsonl`;

/** True for anything inside Keel's own directory — git reports it as `.keel/` while untracked. */
export function isKeelOwnedPath(path: string): boolean {
  const normalised = path.replace(/\/$/, "");
  return normalised === KEEL_DIR || normalised.startsWith(`${KEEL_DIR}/`);
}

/** M1's order, exactly. Serialisation walks this list. */
const FIELD_ORDER = [
  "run",
  "gate",
  "event",
  "artifact",
  "artifact_hash",
  "actor",
  "commit",
  "ts",
  "dirty",
  "legacy",
] as const;

const OBJECT_ID = /^([0-9a-f]{40}|[0-9a-f]{64})$/;
const ISO_MS_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** Strict: an unknown key means the writer disagreed with M1, which must not pass silently. */
const gateEventSchema = z.strictObject({
  run: z.string().min(1),
  gate: z.enum(GATE_ORDER),
  event: z.enum(["pass", "reopen"]),
  artifact: z.string().min(1),
  artifact_hash: z.string().regex(OBJECT_ID),
  actor: z.string().min(1),
  commit: z.string().regex(OBJECT_ID),
  ts: z.string().regex(ISO_MS_UTC),
  dirty: z.literal(true).optional(),
  legacy: z.literal(true).optional(),
});

export function serialiseGateEvent(event: GateEvent): string {
  const ordered: Record<string, unknown> = {};
  for (const key of FIELD_ORDER) {
    const value = event[key];
    if (value !== undefined) ordered[key] = value;
  }
  return JSON.stringify(ordered);
}

export type GateEventParse =
  | { ok: true; event: GateEvent }
  | { ok: false; code: "ledger-line-malformed" | "ledger-entry-invalid"; detail: string };

export function parseGateEventLine(line: string): GateEventParse {
  let json: unknown;
  try {
    json = JSON.parse(line);
  } catch (error) {
    return {
      ok: false,
      code: "ledger-line-malformed",
      detail: (error as Error).message.split("\n")[0] ?? "not valid JSON",
    };
  }

  const result = gateEventSchema.safeParse(json);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path.join(".");
    return {
      ok: false,
      code: "ledger-entry-invalid",
      detail: field ? `field \`${field}\`: ${issue?.message}` : (issue?.message ?? "invalid entry"),
    };
  }

  return { ok: true, event: result.data as GateEvent };
}

export function ledgerDiagnostic(args: {
  code: Diagnostic["code"];
  line: number;
  detail: string;
}): Diagnostic {
  return {
    code: args.code,
    path: LEDGER_PATH,
    line: args.line,
    message: `${LEDGER_PATH} line ${args.line} is unusable (${args.detail}) — the entry is ignored; restore it from git history rather than hand-editing.`,
  };
}

/** The feature a per-feature gate belongs to, read from its artifact path. */
export function featureOfArtifact(artifact: string): string | null {
  return /(?:^|\/)features\/([^/]+)\//.exec(artifact)?.[1] ?? null;
}
