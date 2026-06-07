---
description: Regenerate the "Now" snapshot in the run's STATUS.md from artifact frontmatter + tasks
---

Regenerate the **Now** block of `specs/<run>/STATUS.md` for the active run. This is pure derivation — never invent state.

Read each artifact's YAML frontmatter (`phase`, `gate`, `status`) and the `tasks.md` checkboxes, then rewrite **only** the `## Now` block:

- **Phase:** the highest phase reached, out of 8.
- **Gates:** one glyph per gate from frontmatter `status` — `✓` signed-off · `▶` in progress · `—` not reached.
- **Tasks:** count of `[x]` done vs. total across the run's `features/*/tasks.md`.
- **Next action:** the next command/step implied by the current phase + gate (e.g. `/hld`, or `/lld <feature>`).

Do **not** touch the **Session log**. If `STATUS.md` doesn't exist yet, create it from `templates/status.md` first.
