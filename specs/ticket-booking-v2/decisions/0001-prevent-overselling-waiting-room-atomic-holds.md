# ADR 0001 — Prevent overselling with per-seat atomic holds + a virtual waiting room

- **Status:** Accepted
- **Date:** 2026-06-07
- **Run:** ticket-booking-v2

## Context

N1/N2 demand zero overselling under ~50k concurrent buyers for one event. The inventory row for a hot event is a contention hotspot; *how load reaches it* and *what arbitrates the hold* is the core decision.

## Decision

Two layers: (1) a **virtual waiting room** admits a paced number of buyers, shedding load *before* it reaches inventory; (2) the hold itself is **atomic and store-arbitrated** — reserved seats via a `UNIQUE(event_id, seat_id)` active-hold constraint, GA via a guarded atomic decrement. Inventory is **partitioned by event**.

## Alternatives considered

| Criterion | Pessimistic lock | Optimistic CAS | Waiting room + atomic hold (chosen) |
|-----------|------------------|----------------|-------------------------------------|
| Correctness | ✓ | ✓ | ✓ (store-enforced) |
| Throughput under 50k | ✗ hot-row stall | ✗ retry storms | ✓ load shaped first |
| Complexity | low | medium | medium–high |
| Fairness | poor | poor | ✓ queue position |

## Consequences

- **Positive:** the invariant is enforced by the store; load is capped to what the core can serve; events are isolated from each other.
- **Negative / trade-off:** the waiting room is new infrastructure; a single mega-event is still bounded by one partition's throughput (mitigated by the queue; seat-block sharding if ever needed).
