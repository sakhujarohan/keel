---
artifact: tasks
phase: 6
gate: "—"
status: draft
updated: 2026-07-21
---

# Tasks — state-projection

**Run:** keel-v2 · **LLD:** `./lld.md` · **Spec-check:** `./spec-check.md`

Status: `[ ]` todo · `[~]` in progress · `[x]` done (its check passes)

Three tasks: derive, render, write. The pure parts come first so the file-touching part has nothing
left to get wrong.

## Wave 1 — no dependencies

### T1 — Derive the run state
- **Goal:** `deriveRunState(run, gates) → RunState` — phase from the furthest sealed gate, one line
  per gate with its glyph and date, the task rollup, and the single next action.
- **Done when:** a run with G1–G3 sealed reads as phase 3 with `✓ ✓ ✓ — — —`; a broken seal shows ⚠
  and makes the next action "re-confirm"; an empty ledger reads as phase 0; no clock is consulted.
- **Files:** `packages/core/src/project/state.ts`, `packages/core/src/project/state.test.ts` · **Depends on:** — · **Satisfies:** R9
- `[x]`

## Wave 2 — depends on T1

### T2 — Render the Now block
- **Goal:** `renderNowBlock(state) → string`, matching the shape in `templates/status.md`.
- **Done when:** rendering is deterministic (same state → identical bytes) and the output round-trips
  through the run-model's `splitStatus` without producing a diagnostic.
- **Files:** `packages/core/src/project/render.ts`, `packages/core/src/project/render.test.ts` · **Depends on:** T1 · **Satisfies:** R9
- `[x]`

## Wave 3 — depends on T2

### T3 — Write, without touching what we do not own
- **Goal:** `writeStatus` (replaces only the zone above `## Session log`) and `setArtifactState`
  (replaces two frontmatter values, line-oriented, leaving every other byte alone).
- **Done when:** the session log is byte-identical after a write, including its trailing whitespace;
  a STATUS with no `## Session log` aborts rather than truncating; an artifact whose frontmatter
  carries comments and extra keys keeps all of them, with only `status`/`updated` changed; re-running
  reports `changed: false` and performs no write.
- **Files:** `packages/core/src/project/write.ts`, `packages/core/src/project/write.test.ts` · **Depends on:** T2 · **Satisfies:** R9, R5, R8, M6/A5
- `[x]`

---

## Breakdown checklist
- [x] Every task's **Goal** and **Done when** read clearly on their own
- [x] Dependencies form no cycles; no two tasks in a wave touch the same file
- [x] Each task is small enough that its "Done when" is a single observable check
