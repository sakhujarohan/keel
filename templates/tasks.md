<!--
TEMPLATE: Task Breakdown (Phase 5, per feature). Copy to specs/<run>/features/<feature>/tasks.md.
Tasks are atomic, testable, dependency-ordered. Grouped into waves: a wave's tasks have all dependencies
met and can run in parallel (even on different agents). No two tasks in one wave may touch the same file.
Delete these comments as you go.
-->

# Tasks — <feature>

**Run:** <run> · **LLD:** `./lld.md`

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done (tests green)

---

## Wave 1 — no dependencies (parallelizable)

### T1 — <short imperative title>
- **Does:** <one focused change>
- **Definition of done:** <observable, testable outcome>
- **Serves:** R<x>
- **Depends on:** —
- **Touches:** <files — must not overlap other Wave-1 tasks>
- `[ ]`

### T2 — <title>
- **Does:**
- **Definition of done:**
- **Serves:** R<y>
- **Depends on:** —
- **Touches:**
- `[ ]`

## Wave 2 — depends on Wave 1

### T3 — <title>
- **Does:**
- **Definition of done:**
- **Serves:** R<x>
- **Depends on:** T1
- **Touches:**
- `[ ]`

---

## Breakdown checklist

- [ ] Every task has a definition of done and requirement traceability
- [ ] Dependencies form no cycles
- [ ] No two tasks in the same wave touch the same file
- [ ] Each task is small enough to test on its own
