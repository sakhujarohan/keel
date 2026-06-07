# Run Status — ticket-booking

## Now
<!-- DERIVED by /status — do not hand-edit. Glyphs: ✓ signed-off · ▶ in progress · — not reached. -->

- **Phase:** 5 / 8 — Task Breakdown done; build not started
- **Gates:** G1 ✓ · G2 ✓ · G3 ✓ · G4 ✓ · G5 —
- **Tasks:** 0 / 6 done (book-seat)
- **Next action:** Phase 6 — build wave 1 (`T1` schema, `T2` domain types)

## Session log
<!-- Append-only, newest on top. /handoff prepends one entry per work session. -->

### 2026-06-07 — design spine validated (dry run)
- **Did:** Ran Phases 0–5 + ADR 0001 for the booking service; stack = Go + Postgres via the NFR drivers. Retrofitted the artifacts with v1.1 status frontmatter.
- **Decisions / gotchas:** Double-booking prevented by a `UNIQUE(event_id, seat_id)` constraint (ADR 0001); map Postgres `23505` → `409`.
- **Next:** build wave 1 (`T1`, `T2`), then wave 2 (`T3`, `T4`) — keep the build green.
