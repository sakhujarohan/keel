# Run Status — ticket-booking

## Now
<!-- DERIVED by /status — do not hand-edit. Glyphs: ✓ signed-off · ▶ in progress · — not reached. -->

- **Phase:** 5 / 8 — design complete for all features; task breakdown started; build not begun
- **Gates:** G1 ✓ · G2 ✓ · G3 ✓ · G4 ✓ (all 6 features) · G5 —
- **LLDs:** 6 / 6 (catalog-search, waiting-room, seat-hold, checkout-saga, waitlist, refunds)
- **Tasks:** seat-hold done (7) · 5 features pending
- **Next action:** `/tasks waiting-room` and `/tasks checkout-saga`, then `/implement seat-hold`

## Session log
<!-- Append-only, newest on top. -->

### 2026-06-09 — diagrams switched to D2
- **Did:** Re-rendered all 8 real diagrams from PlantUML/C4 → **D2** (keel's new default renderer) and updated the HLD `<details>` source blocks to match. Renderer recorded in `context.md`.
- **Next:** unchanged — task-break the other core features, then build `seat-hold` test-first.

### 2026-06-07 — regenerated to the v1.3 bar (same input as v2)
- **Did:** Re-ran the event-ticketing platform from the v2 input through keel's v1.3 templates. Real Kroki SVGs (C4 context/containers, both flows, ER, three class diagrams), a detailed data model, two full ADRs (options + pros/cons + pitfalls), an LLD for **all six** features, and readable Goal/Done-when tasks for the crux.
- **Decisions / gotchas:** no-oversell = waiting room + per-seat `UNIQUE` active-hold + per-event partition (ADR 0001); checkout = idempotent saga with compensation (ADR 0002); Redis paces but never guards correctness.
- **Next:** task-break the other core features, then build `seat-hold` test-first.
