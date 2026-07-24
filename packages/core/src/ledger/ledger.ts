/**
 * Reading and appending `.keel/gates.jsonl`.
 *
 * Append-only, always: a reopen is a new line, never an edit. Entries are ordered by position in
 * the file, never by `ts` — a skewed clock must not be able to reorder history.
 */

import { mkdir, open, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { KeelError } from "../model/errors.js";
import type { Diagnostic, Gate } from "../model/types.js";
import {
  type GateEvent,
  LEDGER_PATH,
  ledgerDiagnostic,
  parseGateEventLine,
  serialiseGateEvent,
} from "./event.js";

export interface SealKey {
  run: string;
  gate: Gate;
  artifact: string;
}

export interface LedgerView {
  /** True if .keel/gates.jsonl file existed on disk. */
  readonly exists: boolean;
  /** Every valid entry, in file order. */
  readonly entries: readonly GateEvent[];
  readonly diagnostics: readonly Diagnostic[];
  latestFor(key: SealKey): GateEvent | undefined;
  historyFor(key: SealKey): readonly GateEvent[];
  keysFor(run: string): readonly SealKey[];
}

export function keyOf(key: SealKey): string {
  return `${key.run} ${key.gate} ${key.artifact}`;
}

export async function readLedger(repoRoot: string): Promise<LedgerView> {
  const absolute = join(repoRoot, LEDGER_PATH);

  let raw: string;
  try {
    raw = await readFile(absolute, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    // No ledger simply means no gate has ever been sealed here.
    if (code === "ENOENT") return buildView([], [], false);
    throw new KeelError({
      code: "ENV_UNREADABLE",
      message: `Cannot read ${LEDGER_PATH} (${code}).`,
      nextAction: "Fix the file's permissions, then re-run.",
      path: absolute,
    });
  }

  const entries: GateEvent[] = [];
  const diagnostics: Diagnostic[] = [];

  raw.split("\n").forEach((line, index) => {
    if (line.trim().length === 0) return;

    const parsed = parseGateEventLine(line);
    if (parsed.ok) {
      entries.push(parsed.event);
      return;
    }
    // One unusable line must never cost us the rest of the ledger.
    diagnostics.push(
      ledgerDiagnostic({ code: parsed.code, line: index + 1, detail: parsed.detail }),
    );
  });

  return buildView(entries, diagnostics, true);
}

function buildView(entries: GateEvent[], diagnostics: Diagnostic[], exists: boolean): LedgerView {
  const byKey = new Map<string, GateEvent[]>();
  for (const entry of entries) {
    const key = keyOf(entry);
    const bucket = byKey.get(key);
    if (bucket) bucket.push(entry);
    else byKey.set(key, [entry]);
  }

  return {
    exists,
    entries,
    diagnostics,
    latestFor(key) {
      const bucket = byKey.get(keyOf(key));
      return bucket?.[bucket.length - 1];
    },
    historyFor(key) {
      return byKey.get(keyOf(key)) ?? [];
    },
    keysFor(run) {
      const seen = new Map<string, SealKey>();
      for (const entry of entries) {
        if (entry.run !== run) continue;
        const key: SealKey = { run: entry.run, gate: entry.gate, artifact: entry.artifact };
        seen.set(keyOf(key), key);
      }
      return [...seen.values()];
    },
  };
}

/**
 * Append one entry.
 *
 * A single write to a file opened `O_APPEND` is atomic on POSIX below PIPE_BUF (4 KiB), so
 * concurrent seals interleave whole lines rather than fragments. The handle is synced before we
 * report success: a sign-off has to survive a crash.
 */
export async function appendGateEvent(repoRoot: string, entry: GateEvent): Promise<void> {
  const absolute = join(repoRoot, LEDGER_PATH);
  await mkdir(dirname(absolute), { recursive: true });

  const line = `${serialiseGateEvent(entry)}\n`;
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(absolute, "a", 0o644);
    await handle.write(line);
    await handle.sync();
  } catch (error) {
    throw new KeelError({
      code: "ENV_UNREADABLE",
      message: `Cannot append to ${LEDGER_PATH} (${(error as NodeJS.ErrnoException).code}).`,
      nextAction: "Check disk space and the file's permissions, then re-run.",
      path: absolute,
    });
  } finally {
    await handle?.close();
  }
}
