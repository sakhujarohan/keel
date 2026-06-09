---
artifact: conventions
phase: 3
gate: "—"
status: draft
updated: 2026-06-07
---

# Project Codebook — ticket-booking-v3

## Tech stack
- Java 21 + Spring Boot
- PostgreSQL (partitioned by `event_id`) + Redis (queue + hold cache)
- Kafka (async/saga) · Elasticsearch (search) · external PSP via adapter

## Project structure

```
services/
  inventory/      # hold manager, inventory store, expiry sweeper
  orders/         # order saga, payment adapter
  catalog/        # search
  waiting-room/   # admission + tokens
  notification/
platform/         # shared: idempotency, events, money
migrations/
```

## Conventions
- **Money:** integer minor units (`long` cents) end to end; never floating point.
- **Idempotency:** every mutating endpoint takes an `Idempotency-Key`, stored with its response in the same transaction.
- **Errors:** typed domain errors → HTTP (`409` conflict, `402` payment, `404` not found); never leak internals.
- **Tests:** JUnit + Testcontainers (real Postgres/Redis/Kafka) for integration; the no-oversell race test is mandatory.

## Key implementation patterns
- **No-oversell (reserved):** insert an active hold guarded by `UNIQUE(event_id, seat_id) WHERE released_at IS NULL`; a unique violation means the seat is taken.
- **No-oversell (GA):** `UPDATE ga_inventory SET remaining = remaining - :n WHERE remaining >= :n` — affects 0 rows when insufficient.
- **Hold expiry:** `expires_at` on the hold; a sweeper releases; reads treat an expired hold as released.
- **Saga idempotency:** each step keyed by `(orderId, step)`; replays are no-ops; compensation releases the hold + voids the auth.

## Do NOT
- Do NOT treat Redis as the inventory source of truth — Postgres constraints are the guard.
- Do NOT charge before a valid, unexpired hold exists.
- Do NOT add a Kafka consumer that isn't idempotent (delivery is at-least-once).
- Do NOT use floating point for money.
