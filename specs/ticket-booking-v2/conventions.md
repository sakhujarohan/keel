---
artifact: conventions
phase: 3
gate: "—"
status: draft
updated: 2026-06-07
---

# Project Codebook — ticket-booking-v2

## Tech Stack
- Language / runtime: Java 21 + Spring Boot
- Data store: PostgreSQL (partitioned by `event_id`) + Redis (queue + hold cache)
- Async: Kafka · Search: Elasticsearch · Payments: external PSP via adapter

## Project Structure

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
- **Idempotency:** every mutating endpoint takes an `Idempotency-Key`, stored with its response inside the same transaction.
- **Errors:** typed domain errors → HTTP (`409` conflict, `402` payment, `404` not found); never leak internals.
- **Tests:** JUnit + Testcontainers (real Postgres/Redis/Kafka) for integration; the no-oversell race test is mandatory.

## Key Implementation Patterns
### No-oversell hold
- Reserved: `INSERT` an active hold guarded by `UNIQUE(event_id, seat_id) WHERE released_at IS NULL`; unique violation → seat taken.
- GA: atomic guarded decrement — `UPDATE … SET remaining = remaining - :n WHERE remaining >= :n`.
### Hold expiry
- `expires_at` on the hold; a sweeper releases expired holds; reads treat an expired hold as released.
### Saga idempotency
- Each saga step keyed by `(orderId, step)`; replays are no-ops; compensation releases the hold + voids the authorization.

## Do NOT
- Do NOT treat Redis as the inventory source of truth — Postgres constraints are the guard.
- Do NOT charge before a valid, unexpired hold exists.
- Do NOT add a Kafka consumer that isn't idempotent (delivery is at-least-once).
- Do NOT use floating point for money.
