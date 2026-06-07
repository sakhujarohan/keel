---
artifact: tasks
phase: 5
gate: "—"
status: draft
updated: 2026-06-07
---

# Tasks — book-seat

**Run:** ticket-booking · **LLD:** `./lld.md`

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done (tests green)

## Wave 1 — no dependencies (parallelizable)

### T1 — schema migration: seats, bookings, UNIQUE(event_id, seat_id)
- **Does:** add migration creating both tables + the unique constraint + FK.
- **DoD:** migration applies cleanly; constraint present in schema.
- **Serves:** R1, R3, N1 · **Depends on:** — · **Touches:** `migrations/`
- `[ ]`

### T2 — domain types: Booking, ErrConflict, ErrNotFound
- **Does:** define the record and sentinel errors.
- **DoD:** package compiles.
- **Serves:** R1, R2, R5 · **Depends on:** — · **Touches:** `internal/booking/types.go`
- `[ ]`

## Wave 2 — depends on Wave 1

### T3 — BookingRepository.Insert (maps 23505→ErrConflict, FK→ErrNotFound)
- **Does:** single transactional insert + SQLSTATE mapping.
- **DoD:** unit tests for success, conflict, not-found mappings.
- **Serves:** R1, R2, R3, R5 · **Depends on:** T1, T2 · **Touches:** `internal/booking/repo.go`
- `[ ]`

### T4 — BookingService.Book
- **Does:** orchestrate insert; surface domain errors.
- **DoD:** service test (happy + conflict).
- **Serves:** R1, R2, R3 · **Depends on:** T2 · **Touches:** `internal/booking/service.go`
- `[ ]`

## Wave 3 — depends on Wave 2

### T5 — HTTP handler POST /events/{eventId}/bookings
- **Does:** parse, call service, map errors to 201/409/404.
- **DoD:** handler test for each status.
- **Serves:** R1, R2, R5 · **Depends on:** T3, T4 · **Touches:** `internal/http/handler.go`
- `[ ]`

### T6 — integration test: N concurrent bookings of one seat → exactly one 201
- **Does:** fire concurrent requests at one seat against a real Postgres.
- **DoD:** deterministically one 201, rest 409; one booking row.
- **Serves:** R3, N1 · **Depends on:** T5 · **Touches:** `internal/http/handler_test.go`
- `[ ]`

## Breakdown checklist
- [x] Every task has DoD + traceability
- [x] No dependency cycles
- [x] No two tasks in a wave touch the same file
- [x] Each task independently testable
