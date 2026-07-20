---
artifact: tasks
phase: 5
gate: "—"            # no gate; progress tracked by checkboxes
status: draft        # draft | signed-off
updated: <YYYY-MM-DD>
---

<!--
TEMPLATE: Task Breakdown (Phase 5, per feature). Copy to specs/<run>/features/<feature>/tasks.md.
Each task reads plainly: what we're building and WHY, and the observable check that proves it's done.
Tasks group into dependency waves — a wave's tasks can run in parallel (no two touch the same file).
Delete these comments.
-->

# Tasks — <feature>

**Run:** <run> · **LLD:** `./lld.md`

Status: `[ ]` todo · `[~]` in progress · `[x]` done (its check passes)

## Wave 1 — no dependencies (parallelizable)

### T1 — <plain-language title>
- **Goal:** <what we're building and why it matters — a sentence a human gets without decoding IDs>
- **Done when:** <the observable check that proves it — e.g. "50 parallel holds on one seat → exactly one 201, the rest 409">
- **Files:** <paths> · **Depends on:** — · **Satisfies:** R<x>
- `[ ]`

### T2 — <title>
- **Goal:**
- **Done when:**
- **Files:** · **Depends on:** — · **Satisfies:** R<y>
- `[ ]`

## Wave 2 — depends on Wave 1

### T3 — <title>
- **Goal:**
- **Done when:**
- **Files:** · **Depends on:** T1 · **Satisfies:** R<x>
- `[ ]`

---

## Breakdown checklist
- [ ] Every task's **Goal** and **Done when** read clearly on their own (no ID-decoding needed)
- [ ] Dependencies form no cycles; no two tasks in a wave touch the same file
- [ ] Each task is small enough that its "Done when" is a single observable check
