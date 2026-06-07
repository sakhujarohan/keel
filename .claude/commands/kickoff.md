---
description: Start a Keel run — set mode, time budget, and rigor profile
argument-hint: [run-name or one-line problem]
---

You are starting a new Keel run. Read `AGENTS.md` and `workflow/lifecycle.md` (Phase 0) first.

Input: $ARGUMENTS

Do Phase 0 — Kickoff:
1. Agree a short kebab-case `<run>` name and create `specs/<run>/`.
2. Determine **mode** (new project / feature in an existing codebase), **time budget**, and **rigor profile** (`prototype` / `standard` / `production`, see `profiles/`). If the budget is tight, say so — you'll follow `workflow/fast-path.md` for the rest of the run.
3. Write `specs/<run>/context.md`: mode, budget, profile, any per-concern overrides, and a one-line framing of the problem.

Do **not** start analyzing or solving the problem. Confirm mode + profile with the human, then stop. Next: `/requirements`.
