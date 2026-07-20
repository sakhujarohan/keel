/**
 * The only two places Keel writes into a file a human authored — and both write *state*, never
 * content (M6, exception A5).
 *
 * `writeStatus` replaces the derived zone of STATUS.md and copies the append-only session log
 * through byte-for-byte. `setArtifactState` changes two frontmatter values with a line-oriented
 * edit rather than re-serialising the YAML, so comments, key order and everything else survive.
 */

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { KeelError } from "../model/errors.js";
import { applyArtifactState } from "../model/frontmatter-state.js";
import type { ArtifactStatus, RunEntry } from "../model/types.js";
import { renderNowBlock, SESSION_LOG_HEADING } from "./render.js";
import type { RunState } from "./state.js";

export interface WriteResult {
  path: string;
  /** False when the file already said exactly this — no write is performed. */
  changed: boolean;
}

export async function writeStatus(args: {
  repoRoot: string;
  run: RunEntry;
  state: RunState;
}): Promise<WriteResult> {
  const path = `${args.run.dir}/STATUS.md`;
  const absolute = join(args.repoRoot, path);

  const raw = await read(absolute, path);
  const index = raw.indexOf(SESSION_LOG_HEADING);

  // Without the heading we cannot tell where the human's log begins, and truncating an
  // append-only record is not a risk worth taking to save a manual edit.
  if (index < 0) {
    throw new KeelError({
      code: "ENV_UNREADABLE",
      message: `${path} has no "${SESSION_LOG_HEADING}" heading, so the derived zone cannot be told from the log.`,
      nextAction: `Add a "${SESSION_LOG_HEADING}" heading to ${path}, then re-run.`,
      path: absolute,
    });
  }

  const sessionLog = raw.slice(index);
  const next = `${renderNowBlock(args.state)}\n${sessionLog}`;

  if (next === raw) return { path, changed: false };

  await writeFile(absolute, next, "utf8");
  return { path, changed: true };
}

export async function setArtifactState(args: {
  repoRoot: string;
  path: string;
  status: ArtifactStatus;
  /** YYYY-MM-DD, supplied by the caller — this feature never reads a clock. */
  updated: string;
}): Promise<WriteResult> {
  const absolute = join(args.repoRoot, args.path);
  const raw = await read(absolute, args.path);

  // The identical transform gate-ledger hashed when it sealed, so the written bytes match the
  // seal to the byte and the projection never breaks the seal it belongs to.
  const result = applyArtifactState({ raw, status: args.status, updated: args.updated });
  if (!result.ok) {
    const detail =
      result.reason === "no-frontmatter"
        ? "has no frontmatter block, so there is no state to set"
        : result.reason === "missing-status"
          ? "frontmatter has no `status:` line to update"
          : "frontmatter has no `updated:` line to update";
    throw new KeelError({
      code: "ENV_UNREADABLE",
      message: `${args.path} ${detail}.`,
      nextAction: `Fix the frontmatter of ${args.path}, then re-run.`,
      path: absolute,
    });
  }

  if (!result.changed) return { path: args.path, changed: false };

  await writeFile(absolute, result.text, "utf8");
  return { path: args.path, changed: true };
}

async function read(absolute: string, path: string): Promise<string> {
  try {
    return await readFile(absolute, "utf8");
  } catch (error) {
    throw new KeelError({
      code: "ENV_UNREADABLE",
      message: `Cannot read ${path} (${(error as NodeJS.ErrnoException).code}).`,
      nextAction: "Check the file exists and is readable, then re-run.",
      path: absolute,
    });
  }
}
