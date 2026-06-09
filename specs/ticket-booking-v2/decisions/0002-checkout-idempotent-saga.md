# ADR 0002 — Checkout as an idempotent order saga with compensation

- **Status:** Accepted
- **Date:** 2026-06-07
- **Run:** ticket-booking-v2

## Context

Checkout spans an external PSP that can be slow, fail, or deliver capture asynchronously (webhook). R6/R7/R10 + N8 require exactly-once confirmation, no double-charge, and inventory released on failure — across client retries and at-least-once messaging.

## Decision

Model checkout as an orchestrated **saga**: `hold → authorize (sync) → await capture webhook → confirm + issue`. Every step carries an **idempotency key** and is replay-safe; on decline/timeout the saga **compensates** (release the hold, void the authorization). Saga state is durable; Kafka carries the steps and downstream events.

## Alternatives considered

- **Synchronous in-request charge** — simple, but blocks on a slow PSP, can't model async capture, and a mid-request crash leaves ambiguous state. Rejected.
- **Two-phase commit across the PSP** — PSPs don't participate in 2PC. Not viable.

## Consequences

- **Positive:** exactly-once confirm; clean failure compensation; resilient to PSP latency and at-least-once delivery.
- **Negative / trade-off:** a saga + idempotency store is more moving parts; every consumer must be idempotent (enforced in `conventions.md`).
