---
artifact: stack
phase: 3
gate: G3
status: signed-off
updated: 2026-06-07
---

# Stack Selection — ticket-booking-v3

**Status:** LOCKED ([SIMULATED] G3) · Drivers: the NFRs in `requirements.md`, the shape in `hld.md`

## Decisions

| Choice | Candidates | Decision | Why (the driver) | ADR |
|--------|-----------|----------|------------------|-----|
| Inventory & orders store | PostgreSQL, MySQL, Spanner | **PostgreSQL**, partitioned by event | No-oversell via a UNIQUE/atomic op + durable, strongly consistent | 0001 |
| Service language | Java/Spring, Go, Kotlin | **Java + Spring Boot** | Transactional correctness, mature ecosystem, team fluency | — |
| Queue + hold cache | Redis, Memcached | **Redis** | Waiting-room tokens + hot availability cache + TTL semantics | — |
| Async / saga + events | Kafka, RabbitMQ, SQS | **Kafka** | Durable ordered log for saga steps, notifications, search sync | 0002 |
| Catalog search | Elasticsearch, Postgres FTS | **Elasticsearch** | Search at scale, decoupled from the strongly-consistent core | — |
| Payment | external PSP via adapter | **PSP** (idempotent authorize/capture + webhooks) | Constraint: never store card data | 0002 |

## Stack conventions

The per-project codebook lives in `conventions.md` — project layout, the money/idempotency patterns, and the "Do NOT" list the build follows.

## Known trade-offs & risks

- **Partition-by-event** scales hot events independently, but one mega-event is still bounded by a single partition's write throughput — the waiting room keeps that within budget; shard a single event across seat-blocks only if ever needed.
- **Kafka is at-least-once**, so every consumer (confirm, notify, search-sync) must be idempotent — non-negotiable.
- Redis holds are a cache/coordinator, **not** the source of truth — the Postgres UNIQUE active-hold constraint is the real guard.

## G3 — Stack Lock
- [x] Every choice is traced to a driver
- [x] Load-bearing choices have ADRs (0001 store/oversell, 0002 saga/eventing)
- [x] Trade-offs stated
- [x] [SIMULATED] human locked the stack
