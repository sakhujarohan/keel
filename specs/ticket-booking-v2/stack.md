---
artifact: stack
phase: 3
gate: G3
status: signed-off
updated: 2026-06-07
---

# Stack Selection — ticket-booking-v2

**Status:** LOCKED ([SIMULATED] G3) · **Drivers:** NFRs in `requirements.md`, shape in `hld.md`

## Decisions

| Choice | Candidates | Decision | Driver | ADR |
|--------|-----------|----------|--------|-----|
| Inventory & orders store | PostgreSQL, MySQL, Spanner | **PostgreSQL** (partitioned by event) | N1 no-oversell via UNIQUE/atomic ops + N7 durability + strong consistency | 0001 |
| Service language | Java/Spring, Go, Kotlin | **Java + Spring Boot** | transactional correctness, mature ecosystem, team fluency | — |
| Queue + hold cache | Redis, Memcached | **Redis** | virtual waiting-room tokens + hot availability cache + TTL semantics | — |
| Async / saga + events | Kafka, RabbitMQ, SQS | **Kafka** | durable ordered log for saga steps, notifications, search sync (N8 at-least-once) | 0002 |
| Catalog search | Elasticsearch, Postgres FTS | **Elasticsearch** | R1/R2 search at scale, decoupled from the strong-consistency core (N5) | — |
| Payment | external PSP via adapter | **PSP (idempotent authorize/capture + webhooks)** | constraint: never store PANs | 0002 |

## Stack Conventions

Produce **`specs/ticket-booking-v2/conventions.md`** — the per-project codebook (layout, money/idempotency patterns, and the Do-NOT list the build follows).

## Known Trade-offs & Risks

- **Partition-by-event** scales hot events independently, but a single mega-event is still bounded by one partition's write throughput — the **waiting room** keeps that within budget; shard a single event across seat-blocks only if ever needed.
- **Kafka at-least-once** means every consumer (confirm, notify, search-sync) must be **idempotent** — non-negotiable (N8).
- Redis holds are a cache/coordinator, **not** the source of truth — the Postgres `UNIQUE` active-hold constraint is the real guard (Redis being wrong can never cause an oversell).

## G3 — Stack Lock
- [x] Every major choice traced to a driver
- [x] Load-bearing choices have ADRs (0001 store/oversell, 0002 saga/eventing)
- [x] Trade-offs stated (hot-partition ceiling, idempotent consumers)
- [x] [SIMULATED] human locked the stack
