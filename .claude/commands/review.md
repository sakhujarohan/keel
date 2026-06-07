---
description: Phase 7 — harden and review against the rigor profile (gate G5)
---

Run Phase 7 of the active Keel run. Read `workflow/lifecycle.md` (Phase 7), the chosen profile in `profiles/`, and `templates/review-checklist.md` first.

Produce `specs/<run>/review-checklist.md` and:
- Run the checklist **scoped to the run's rigor profile**. Close the gaps it surfaces.
- Finish the README: how to run, approach and key decisions, known limitations (and how you'd close them). Include AI-usage notes if relevant.
- Ensure every load-bearing decision made during the build has an ADR in `decisions/`.

A deliberately skipped concern is acceptable **only if documented** as a known limitation — an undocumented gap is a defect. Then STOP at **G5 — Ship review**: walk the human through the checklist results, the known limitations, and the README, and confirm it's ready to ship/submit.
