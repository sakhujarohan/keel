# Run Status — ticket-booking-v2

## Now
<!-- DERIVED by /status — do not hand-edit. Glyphs: ✓ signed-off · ▶ in progress · — not reached. -->

- **Phase:** 5 / 8 — design spine complete for the crux feature; build not started
- **Gates:** G1 ✓ · G2 ✓ · G3 ✓ · G4 ✓ (seat-hold) · G5 —
- **Tasks:** 0 / 7 done (seat-hold); 5 features still to LLD
- **Next action:** `/lld waiting-room` and `/lld checkout-saga`, then `/implement seat-hold`

## Session log
<!-- Append-only, newest on top. /handoff prepends one entry per work session. -->

### 2026-06-07 — complex-HLD-round dry run
- **Did:** Took an event-ticketing platform through Phases 0–5 for the crux feature (`seat-hold`). 12 FRs, 9 NFRs, performance targets. HLD with 4 critical design questions, C4 L1–L3, two flow/saga sequence diagrams, and a 6-feature list. Stack chosen for a strong-consistency core + load shaping. ADR 0001 (no-oversell) + 0002 (checkout saga).
- **Decisions / gotchas:** No-oversell = waiting room (load shaping) + per-seat atomic hold (`UNIQUE` active hold) + per-event partition; holds expire via `expires_at` + sweeper; payment via an idempotent saga with compensation.
- **Next:** LLD the remaining features (waiting-room, checkout-saga first), then build `seat-hold` test-first.
