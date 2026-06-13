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
- **Clarify loop (mandatory):** present a batched list of every question whose answer would change the design, OR an explicit statement: *"No design-changing ambiguity found. Here are the assumptions I'm relying on — please confirm each."* Silently adopting assumptions without surfacing them is the **Silent-assumption** anti-pattern and blocks G1. Keep asking until no design-changing ambiguity remains.
- **Assumptions table:** every deliberate default, each requiring explicit human confirmation (`proposed` → `confirmed`). G1 cannot pass while any assumption is `proposed`.
- **Literal Mandates table:** verbatim non-negotiable specifics from the spec (exact status codes, response/error field sets, formats, protocol constraints). Each gets an `M` ID. These power Phase 5 Spec-Compliance Review. Write "None" if the spec contains no literal mandates.

Then STOP at **G1 — Requirements Lock**: present requirements, out-of-scope list, confirmed assumptions, and Literal Mandates; ask the human to confirm they are complete and stable. **Propose no design until they sign off.** Watch for *premature design*, *scope-latch*, and *Silent-assumption*. Next: `/hld`.
