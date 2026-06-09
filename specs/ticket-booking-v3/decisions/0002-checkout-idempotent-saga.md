# ADR 0002 — Checkout as an idempotent order saga with compensation

- **Status:** Accepted
- **Date:** 2026-06-07
- **Run:** ticket-booking-v3

## Problem & forces

Checkout crosses an external payment provider that can be slow, decline, or deliver the final capture asynchronously via webhook. We need **exactly-once confirmation** and **no double-charge**, inventory **released** if payment doesn't complete, and correctness under **client retries** and **at-least-once** message delivery — all while a mid-flight crash must never leave money or inventory in an ambiguous state.

## Options considered

### Option A — Synchronous charge inside the request
- **How it works:** hold → charge → confirm, all in one HTTP request.
- **Pros:** simplest mental model; no orchestration.
- **Cons:** blocks on a slow PSP (ties up threads exactly during the on-sale); can't model async capture webhooks; a crash mid-request leaves payment/inventory in an unknown state. Fails durability/exactly-once.

### Option B — Two-phase commit across the PSP
- **How it works:** coordinate a distributed transaction spanning the PSP.
- **Pros:** would give atomicity in theory.
- **Cons:** PSPs don't participate in 2PC — not implementable. Rejected outright.

### Option C — Orchestrated order saga with idempotency + compensation  ← chosen
- **How it works:** durable saga steps — hold → authorize → await capture webhook → confirm + issue; each step keyed by an idempotency key and replay-safe; on decline/timeout, compensate (release hold, void auth). Kafka carries steps and downstream events.
- **Pros:** exactly-once confirm; survives PSP latency and at-least-once delivery; clean failure handling; crash-safe because saga state is durable.
- **Cons:** more moving parts (a saga state machine + idempotency store); every consumer must be written idempotently.

## Decision

Adopt **Option C** — an orchestrated, durable saga with idempotency keys on every step and explicit compensation on failure or timeout.

## Pitfalls & limitations of the chosen option

- **"Idempotent everywhere" is a discipline, not a freebie.** Any consumer that isn't idempotent reintroduces double-charge/double-issue under retries. Enforced in `conventions.md` and checked at G5.
- **A webhook that never arrives** must be caught by a timeout-driven compensation or a reconciliation job — otherwise a hold/payment can dangle.
- **Saga state is another durable store** to operate, monitor, and reason about.

## Consequences

- **Positive:** exactly-once money; resilient to PSP behavior; recoverable after a crash.
- **Negative / trade-off:** orchestration + idempotency infrastructure to build and run.
- **Follow-ups:** add a reconciliation job for stuck sagas; revisit if the PSP later offers synchronous capture.
