---
description: Phase 4 — low-level design for one feature (gate G4)
argument-hint: <feature-name>
---

Run Phase 4 of the active Keel run for feature: $ARGUMENTS. **Precondition:** G3 is signed off (`stack.md`). Read `workflow/lifecycle.md` (Phase 4) and `templates/lld.md` first.

Produce `specs/<run>/features/<feature>/lld.md`:
- A Mermaid `classDiagram` of the types, key methods, and relationships.
- Exact interfaces/contracts (signatures, endpoints, message shapes).
- The concrete data model (fields, types, keys, indexes, invariants).
- The error model (every failure mode → result → transaction behavior).
- Explicitly show how any concurrency/consistency NFRs are satisfied.
- Trace every type/contract to requirement IDs.

Apply the **One-Line Test**: could a builder implement this from this doc alone? If not, it's underspecified — finish it. Then STOP at **G4 — LLD sign-off**. Watch for *over-engineering* — design the smallest correct structure. Next: `/tasks`.
