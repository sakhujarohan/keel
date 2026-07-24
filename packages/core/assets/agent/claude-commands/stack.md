---
description: Phase 3 — select and lock the tech stack (gate G3)
---

Run Phase 3 of the active Keel run. **Precondition:** G2 is signed off (`hld.md`). Read `workflow/lifecycle.md` (Phase 3) and `templates/stack.md` first.

Produce `specs/<run>/stack.md`:
- For each major choice (language, framework, datastore, messaging, key libs), list realistic candidates and the **driver** — the NFR or constraint that forces the choice. No habit/hype picks.
- Write an ADR in `decisions/` (`templates/adr.md`) for any load-bearing or contested choice.
- Pull in any stack-specific conventions/guidelines doc here and reference it.
- State trade-offs and risks; mark unknowns `UNKNOWN`, never guess a benchmark or limit.

Then STOP at **G3 — Stack Lock**: confirm the stack with the human. After this, the stack is fixed for the run. Next: `/lld`.
