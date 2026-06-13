---
description: Phase 6 — break a feature's LLD into dependency-ordered tasks
argument-hint: <feature-name>
---

Run Phase 6 of the active Keel run for feature: $ARGUMENTS. **Precondition:** G5 is signed off (`spec-check.md`). Read `workflow/lifecycle.md` (Phase 6) and `templates/tasks.md` first.

Produce `specs/<run>/features/<feature>/tasks.md`:
- Atomic, independently testable tasks. Each has a **definition of done**, the **requirement IDs** it serves, its **dependencies**, and the **files it touches**.
- Group into **dependency waves**: a wave's tasks all have their dependencies met and can run in parallel. No two tasks in one wave may touch the same file.

Confirm the breakdown looks right (cheap to fix now), then proceed to build (Phase 7 — execute tasks in wave order, test each against its acceptance criteria before marking done, keep the build green). If building reveals the design is wrong, loop back to `/lld` — do not patch forward. When the feature is built and green: `/review`.
