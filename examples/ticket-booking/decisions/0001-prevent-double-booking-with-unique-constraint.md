# ADR 0001 — Prevent double-booking with a DB unique constraint

- **Status:** Accepted
- **Date:** 2026-06-07
- **Run:** ticket-booking

## Context

N1/R3 require that a seat is never booked twice, even under concurrent requests across multiple service instances. The arbitration mechanism is the core correctness decision of the system.

## Decision

Enforce a `UNIQUE` constraint on `bookings(event_id, seat_id)` and perform a booking as a single transactional `INSERT`. The database arbitrates concurrent writers; the unique violation (Postgres SQLSTATE `23505`) is mapped to a `409 Conflict`.

## Alternatives considered

- **Pessimistic row lock (`SELECT … FOR UPDATE` on the seat)** — correct, but adds lock management and serializes more than necessary when the constraint already enforces the invariant.
- **Optimistic version/CAS on seat status** — needs an app-level retry loop; more moving parts for no benefit at this scale.

## Consequences

- **Positive:** invariant enforced by the store; correct across instances; minimal application logic.
- **Negative / trade-off:** couples correctness to one datastore's constraint semantics; unique-violation-as-control-flow needs disciplined error mapping; single-DB write throughput is the scaling ceiling (shard by event later).
