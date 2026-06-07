---
artifact: stack
phase: 3
gate: G3
status: signed-off
updated: 2026-06-07
---

# Stack Selection — ticket-booking

**Status:** LOCKED ([SIMULATED] G3) · **Drivers:** NFRs in `requirements.md`, shape in `hld.md`

## Decisions

| Choice | Candidates | Decision | Driver | ADR |
|--------|-----------|----------|--------|-----|
| Data store | PostgreSQL, MySQL, in-memory | **PostgreSQL** | N1 correctness via UNIQUE constraint + N2 durability; transactional integrity | 0001 |
| Language | Go, Java, Python | **Go** | Simple concurrency model, single-binary deploy, team fluency | — |
| HTTP | net/http + chi, full framework | **net/http + chi** | One endpoint group; no heavy framework warranted (smallest correct) | — |
| DB driver | pgx, database/sql | **pgx** | Native Postgres, performant, exposes SQLSTATE (maps 23505 → conflict) | — |
| Migrations | golang-migrate | **golang-migrate** | Versioned schema; the UNIQUE constraint is the core invariant | — |

## Stack Conventions
- Layout: standard Go (`cmd/`, `internal/booking`, `internal/http`, `migrations/`).
- Lint: `golangci-lint` default set.

## Known Trade-offs & Risks
- Single Postgres instance is the write ceiling at very high scale — acceptable for v1 (N3 modest); shard by event if needed.
- Unique-violation-as-control-flow requires disciplined error mapping (pgx code `23505` → `409`).

## G3 — Stack Lock
- [x] Every choice traced to a driver
- [x] Load-bearing choice (datastore/correctness) has ADR 0001
- [x] Trade-offs stated; N3 marked UNKNOWN, not guessed
- [x] [SIMULATED] human locked the stack
