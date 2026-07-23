---
description: Phase 5 — spec-compliance review for one feature (gate G5)
argument-hint: <feature-name>
---

Run Phase 5 of the active Keel run for feature: $ARGUMENTS. **Precondition:** G4 is signed off (`lld.md`). Read `workflow/lifecycle.md` (Phase 5) and `templates/spec-check.md` first.

Produce `specs/<run>/features/<feature>/spec-check.md`:
1. Copy the **Literal Mandates** table from `specs/<run>/requirements.md` into the doc.
2. For each mandate, extract the concrete design choice from `lld.md` (endpoint path, status code, response/error shape, format) and state whether they match (✓ / ✗).
3. For each ✗: **do not paper over it.** Either loop back to the earliest affected gate (G2/G3/G4) and fix the design, then re-run this check — or flag the divergence and surface it explicitly to the human for sign-off.

Then STOP at **G5 — Spec-Compliance Lock**: present the ledger and every mismatch. Any ✗ without a human-confirmed exception blocks the gate. Watch for *spec-divergence* — the ADR is not authoritative over the spec; if they conflict, the spec wins. Next: `/tasks`.
