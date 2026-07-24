---
artifact: tasks
phase: 6
gate: "—"
status: draft
updated: 2026-07-20
schema_version: 2
---

# Tasks — widget

## Wave 1 — no dependencies

### T1 — Build the widget
- **Goal:** the widget exists.
- **Done when:** its test passes.
- **Files:** `src/widget.ts` · **Depends on:** — · **Satisfies:** R1
- `[x]`

## Wave 2 — depends on Wave 1

### T2 — Persist the widget
- **Goal:** answers survive a restart.
- **Done when:** the restart test passes.
- **Files:** `src/store.ts` · **Depends on:** T1 · **Satisfies:** R2
- `[ ]`
