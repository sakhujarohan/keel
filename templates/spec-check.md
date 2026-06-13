---
artifact: spec-check
phase: 5
gate: G5
status: draft        # draft | signed-off
updated: <YYYY-MM-DD>
---

<!--
TEMPLATE: Spec-Compliance Review (Phase 5). Copy to specs/<run>/features/<feature>/spec-check.md.
Inputs: features/<feature>/lld.md (G4 signed off) + the Literal Mandates table in specs/<run>/requirements.md.
Delete these HTML comments as you complete each section.
-->

# Spec-Compliance Review — <feature>

**Run:** <run> · **Feature:** <feature> · **Profile:** <prototype | standard | production>

---

## Literal Mandates (from requirements.md)

<!-- Copy the Literal Mandates table from requirements.md verbatim. -->

| ID | Mandate | Source |
|----|---------|--------|
| M1 | | |
| M2 | | |

---

## Spec-Compliance Ledger

<!--
For each Literal Mandate above: state exactly what the LLD specifies (endpoint, status code, field set,
format, etc.) and whether it matches.

Match: ✓ | Mismatch: ✗ (must be fixed OR carry a human-confirmed exception before G5 passes)
-->

| Mandate ID | Mandate | LLD specifies | Match? | Resolution |
|------------|---------|---------------|--------|------------|
| M1 | <e.g. HTTP 201 on success> | <e.g. POST /payments → 201 Created — confirmed in LLD §3.2> | ✓ | — |
| M2 | <e.g. Error body MUST NOT contain IBAN or BIC> | <e.g. ErrorResponse has { code, message } — no financial fields> | ✓ | — |

---

## Mismatches & Resolutions

<!--
For every ✗ row above:
- State the conflict precisely (what the spec says vs. what the LLD says).
- Action: either fix the LLD (loop back to G4) or document a deliberate exception and get human sign-off.
A ✗ with no resolution blocks G5.
-->

_None — all mandates satisfied._ (delete this line if there are mismatches)

---

## G5 — Spec-Compliance Lock

- [ ] Every Literal Mandate has been checked against the LLD
- [ ] All ✗ mismatches are either fixed (G4 re-confirmed) or carry a documented, human-confirmed exception
- [ ] **Human has confirmed: spec-compliance is satisfied for this feature**

> No tasks are written and no code is built until this gate is signed off.
