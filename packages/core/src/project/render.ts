/**
 * Rendering the derived state as the `Now` block a human reads at the top of STATUS.md.
 *
 * Deterministic by construction: same state in, identical bytes out.
 */

import type { RunState } from "./state.js";

export const SESSION_LOG_HEADING = "## Session log";

export function renderNowBlock(state: RunState): string {
  const gates = state.gates
    .map((line) => `${line.gate} ${line.glyph}${line.date ? ` (${line.date})` : ""}`)
    .join(" · ");

  return [
    `# Run Status — ${state.run}`,
    "",
    "## Now",
    "<!-- DERIVED by keel status — do not hand-edit. Glyphs: ✓ sealed · ▶ reopened · ⚠ broken · — not reached. -->",
    "",
    `- **Phase:** ${state.phase} / 8 — ${state.phaseName}`,
    `- **Gates:** ${gates}`,
    `- **Tasks:** ${state.tasksDone} / ${state.tasksTotal} done`,
    `- **Next action:** ${state.nextAction}`,
    "",
  ].join("\n");
}
