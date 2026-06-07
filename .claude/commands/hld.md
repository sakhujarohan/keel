---
description: Phase 2 — high-level design with UML/Mermaid (gate G2)
---

Run Phase 2 of the active Keel run. **Precondition:** G1 is signed off (`requirements.md` is LOCKED) — if not, go back to `/requirements`. Read `workflow/lifecycle.md` (Phase 2) and `templates/hld.md` first.

Produce `specs/<run>/hld.md`:
- Answer the 1–3 **critical design questions** with options, decision, and rationale.
- Draw the architecture in Mermaid at C4 levels 1–3 (Context, Container, Component) plus **sequence diagrams** for the critical flows.
- Give a conceptual data model (entities + relationships).
- Trace every component back to requirement IDs.

Decide **shape and responsibilities only** — not the stack (that's `/stack`), not class detail (that's `/lld`). Then STOP at **G2 — HLD sign-off**: walk the human through the diagrams and critical-question answers and confirm the shape. Next: `/stack`.
