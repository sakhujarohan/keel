---
artifact: tasks
phase: 5
gate: "—"
status: draft
updated: 2026-06-07
---

# Tasks — seat-hold

**Run:** ticket-booking-v2 · **LLD:** `./lld.md`

## Wave 1 — no dependencies (parallel)

### T1 — schema: seats, holds, hold_seats (partial UNIQUE active-hold), ga_inventory, user_event_counter
- **DoD:** migration applies; the partial-unique active-hold index exists. **Serves:** R4, N1. **Touches:** `migrations/`. `[ ]`

### T2 — domain types + errors (Hold, Unavailable, LimitReached, NotFound)
- **DoD:** package compiles. **Serves:** R4, R5, R8. **Touches:** `inventory/domain`. `[ ]`

## Wave 2 — depends on Wave 1

### T3 — InventoryRepository.tryHoldSeats (partial-unique insert; violation → Unavailable)
- **DoD:** unit tests for success + conflict. **Serves:** R4, R5, N1. **Deps:** T1, T2. **Touches:** `inventory/repo`. `[ ]`

### T4 — InventoryRepository.tryHoldGA (guarded decrement) + countUserActive
- **DoD:** unit tests incl. sold-out + limit. **Serves:** R4, R8, N1. **Deps:** T1, T2. **Touches:** `inventory/repo`. `[ ]`

### T5 — HoldService (all-or-nothing hold, idempotency-key, set expiry, limit check)
- **DoD:** service tests (happy, conflict, duplicate-key, limit). **Serves:** R4, R5, R8, R10. **Deps:** T2. **Touches:** `inventory/service`. `[ ]`

## Wave 3 — depends on Wave 2

### T6 — HoldController POST/DELETE (idempotent) + ExpirySweeper job
- **DoD:** handler + sweeper tests (an expired hold releases inventory). **Serves:** R4, R7, N4. **Deps:** T3, T4, T5. **Touches:** `inventory/http`, `inventory/sweeper`. `[ ]`

### T7 — integration: N concurrent holds on one seat → exactly one 201, rest 409 (Testcontainers Postgres)
- **DoD:** deterministic; **proves N1**. **Serves:** N1, N2. **Deps:** T6. **Touches:** `inventory/it`. `[ ]`

## Breakdown checklist
- [x] DoD + traceability per task
- [x] No dependency cycles; no same-file collisions within a wave
- [x] The no-oversell **race test (T7)** is present — the invariant must be *proven*, not assumed
