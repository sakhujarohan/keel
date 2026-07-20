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

const STATUS_LINE = /^status:[ \t]*.*$/m;
const UPDATED_LINE = /^updated:[ \t]*.*$/m;

export async function setArtifactState(args: {
  repoRoot: string;
  path: string;
  status: ArtifactStatus;
  /** YYYY-MM-DD, supplied by the caller — this feature never reads a clock. */
  updated: string;
}): Promise<WriteResult> {
  const absolute = join(args.repoRoot, args.path);
  const raw = await read(absolute, args.path);

  const frontmatter = frontmatterRange(raw);
  if (!frontmatter) {
    throw new KeelError({
      code: "ENV_UNREADABLE",
      message: `${args.path} has no frontmatter block, so there is no state to set.`,
      nextAction: `Add a --- block to ${args.path}, then re-run.`,
      path: absolute,
    });
  }

  const block = raw.slice(frontmatter.start, frontmatter.end);
  // Inserting a missing key would be authoring, which M6 forbids — so demand it already exists.
  for (const [name, pattern] of [
    ["status", STATUS_LINE],
    ["updated", UPDATED_LINE],
  ] as const) {
    if (!pattern.test(block)) {
      throw new KeelError({
        code: "ENV_UNREADABLE",
        message: `${args.path} frontmatter has no \`${name}:\` line to update.`,
        nextAction: `Add \`${name}:\` to the frontmatter of ${args.path}, then re-run.`,
        path: absolute,
      });
    }
  }

  const updatedBlock = block
    .replace(STATUS_LINE, `status: ${args.status}`)
    .replace(UPDATED_LINE, `updated: ${args.updated}`);

  const next = raw.slice(0, frontmatter.start) + updatedBlock + raw.slice(frontmatter.end);
  if (next === raw) return { path: args.path, changed: false };

  await writeFile(absolute, next, "utf8");
  return { path: args.path, changed: true };
}

/** Character range of the YAML between the opening and closing `---` lines. */
function frontmatterRange(raw: string): { start: number; end: number } | null {
  const lines = raw.split("\n");
  if (lines[0]?.trim() !== "---") return null;

  let offset = lines[0].length + 1;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim() === "---") return { start: lines[0].length + 1, end: offset };
    offset += line.length + 1;
  }
  return null;
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
