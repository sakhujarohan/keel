/**
 * The single transform that sets an artifact's *state* frontmatter — `status` and `updated`.
 *
 * It is pure and shared, because two features must agree on it to the byte: `gate-ledger` hashes
 * the result to decide what a seal protects, and `state-projection` writes that same result to
 * disk. If they ever diverged, sealing an artifact would break its own seal (which is exactly the
 * bug this module was extracted to fix).
 *
 * Only the two lines' values change. The YAML is never parsed and re-emitted, so comments, key
 * order and every other byte survive — writing state is not authoring content (M6/A5).
 */

import type { ArtifactStatus } from "./types.js";

const STATUS_LINE = /^status:[ \t]*.*$/m;
const UPDATED_LINE = /^updated:[ \t]*.*$/m;

export type FrontmatterStateResult =
  | { ok: true; text: string; changed: boolean }
  | { ok: false; reason: "no-frontmatter" | "missing-status" | "missing-updated" };

export function applyArtifactState(args: {
  raw: string;
  status: ArtifactStatus;
  updated: string;
}): FrontmatterStateResult {
  const range = frontmatterRange(args.raw);
  if (!range) return { ok: false, reason: "no-frontmatter" };

  const block = args.raw.slice(range.start, range.end);
  // A missing key is an error, not something to insert — inserting a key would be authoring.
  if (!STATUS_LINE.test(block)) return { ok: false, reason: "missing-status" };
  if (!UPDATED_LINE.test(block)) return { ok: false, reason: "missing-updated" };

  const updatedBlock = block
    .replace(STATUS_LINE, `status: ${args.status}`)
    .replace(UPDATED_LINE, `updated: ${args.updated}`);

  const text = args.raw.slice(0, range.start) + updatedBlock + args.raw.slice(range.end);
  return { ok: true, text, changed: text !== args.raw };
}

/** Character range of the YAML between the opening and closing `---` lines. */
function frontmatterRange(raw: string): { start: number; end: number } | null {
  const lines = raw.split("\n");
  if (lines[0]?.trim() !== "---") return null;

  const start = lines[0].length + 1;
  let offset = start;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim() === "---") return { start, end: offset };
    offset += line.length + 1;
  }
  return null;
}
