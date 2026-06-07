---
description: Phase 6 — build a feature test-first, task by task
argument-hint: <feature-name>
---

Build the feature: $ARGUMENTS. **Precondition:** its `tasks.md` exists (Phase 5). Read `workflow/lifecycle.md` (Phase 6), the feature's `lld.md` + `tasks.md`, the run's `conventions.md`, and the rigor profile.

Execute tasks in **dependency-wave order**. For each task, work **test-first** (default for `standard`/`production`; optional for `prototype`):
1. Write the failing test(s) against the task's acceptance criteria.
2. Write the smallest code that passes them.
3. Run the tests; mark the task `[x]` done only when green. Keep the build green.

Update `tasks.md` checkboxes as you go, and run `/status` to refresh the dashboard. If building reveals the design is wrong, **stop and loop back** to `/lld` — don't patch forward. When the feature is built and green, run `/review`.
