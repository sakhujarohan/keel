---
description: Phase 1 — capture and lock requirements (gate G1)
argument-hint: [optional notes or pasted brief]
---

Run Phase 1 of the active Keel run (the run set by `/kickoff`; confirm which `specs/<run>/` if ambiguous). Read `workflow/lifecycle.md` (Phase 1), `principles.md`, and `templates/requirements.md` first. If the budget is tight, also read `workflow/fast-path.md`.

Additional input: $ARGUMENTS

Produce `specs/<run>/requirements.md` from the template:
- Functional requirements in **EARS** notation, each with a stable ID and acceptance criteria.
- Non-functional requirements the problem implies (mark unstated ones `UNKNOWN`).
- Constraints and an **explicit out-of-scope list**.
- A clarify loop: ask — batched — every question whose answer would change the design. Keep asking until no design-changing ambiguity remains.

Then STOP at **G1 — Requirements Lock**: present the requirements and out-of-scope list and ask the human to confirm they are complete and stable. **Propose no design until they sign off.** Watch for *premature design* and *scope-latch*. Next: `/hld`.
