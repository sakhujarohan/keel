# ADR 0001 — Prevent overselling with per-seat atomic holds + a virtual waiting room

- **Status:** Accepted
- **Date:** 2026-06-07
- **Run:** ticket-booking

## Problem & forces

When a hot event goes on sale, ~50,000 buyers hit the same small pool of inventory within seconds. The system must **never** sell a seat twice or exceed GA capacity — across many service instances — while keeping holds fast and the service from collapsing. The tension: the obvious way to be correct (lock the inventory) is exactly what destroys throughput on a single hot row.

## Options considered

### Option A — Pessimistic row lock per seat/event (`SELECT … FOR UPDATE`)
- **How it works:** each hold takes a DB lock on the seat/event row.
- **Pros:** simple; obviously correct.
- **Cons:** the hot-event row serializes everything; under 50k concurrent buyers the lock queue explodes and latency collapses. Fails the scale/latency NFRs.

### Option B — Optimistic concurrency (CAS on availability + app retry)
- **How it works:** read availability, attempt an update with a version check, retry on conflict.
- **Pros:** no held locks; fine under low contention.
- **Cons:** under extreme contention nearly every attempt conflicts → retry storms that *amplify* load. Fails scale/availability.

### Option C — Virtual waiting room + atomic, store-arbitrated hold  ← chosen
- **How it works:** a waiting room admits buyers at a paced rate (load shed *before* inventory); the hold is then a single atomic op the DB arbitrates — a `UNIQUE` active-hold constraint per seat for reserved, a guarded atomic decrement for GA. Inventory is partitioned per event.
- **Pros:** correctness enforced by the store regardless of load; the core only sees a serveable rate; events isolated from each other; fair (queue position).
- **Cons:** the waiting room is extra infrastructure; one mega-event is still bounded by a single partition's write throughput.

| Criterion | A — pessimistic | B — optimistic | C — waiting room + atomic (chosen) |
|-----------|-----------------|----------------|-------------------------------------|
| Correctness | ✓ | ✓ | ✓ (store-enforced) |
| Throughput @ 50k | ✗ hot-row stall | ✗ retry storms | ✓ load shaped first |
| Fairness | poor | poor | ✓ queue position |
| Added infrastructure | none | none | waiting room + partitioning |

## Decision

Adopt **Option C**. The waiting room caps concurrency to what the core can serve; the per-seat `UNIQUE` active-hold constraint (and the guarded GA decrement) make overselling impossible no matter what the application does. Inventory is partitioned by event so events don't interfere.

## Pitfalls & limitations of the chosen option

- A single, enormous event is still ultimately bounded by **one partition's write throughput**. The waiting room keeps that within budget; if one event ever exceeds it, we'd shard inventory across seat-blocks (deferred until a real need).
- The **waiting room must itself be HA and fair** — a bad admission policy can starve buyers or let a stampede through. It needs its own tuning and monitoring.
- **Redis must never be the source of truth.** Only the Postgres constraints guarantee no oversell; if Redis is stale it may slow things but can't cause an oversell — code must rely on the DB for correctness.

## Consequences

- **Positive:** the hard invariant holds under any load; events are isolated; load on the core is predictable.
- **Negative / trade-off:** more moving parts (waiting room + partitioning) to build and operate.
- **Follow-ups:** revisit seat-block sharding only if a single event's demand exceeds one partition's write budget; add waiting-room admission metrics to the SLO dashboard.
