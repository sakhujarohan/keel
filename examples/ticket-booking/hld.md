---
artifact: hld
phase: 2
gate: G2
status: signed-off
updated: 2026-06-07
---

# High-Level Design — ticket-booking

**Status:** LOCKED ([SIMULATED] G2) · **Requirements:** see `requirements.md`

## Critical Design Questions

### Q1 — How is double-booking prevented under concurrency? (serves N1, R3)
- **Options:** (a) pessimistic row lock on the seat (`SELECT … FOR UPDATE`); (b) optimistic version/CAS on seat status; (c) a DB **UNIQUE constraint** on `bookings(event_id, seat_id)` + a single transactional insert.
- **Decision:** (c). The database arbitrates the race — exactly one writer commits, the rest get a constraint violation mapped to `409`.
- **Why:** Simplest correct option. No app-level lock coordination, correct across multiple service instances, and the invariant is enforced by the store itself. (→ ADR `0001`)

## C4 Level 1 — Context

```mermaid
graph TB
  user[User] -->|browse, book| svc[Booking Service]
  svc --> db[(Relational DB)]
```

## C4 Level 2/3 — Containers & Components

```mermaid
graph LR
  api[HTTP API] --> svc[BookingService]
  svc --> seats[SeatRepository]
  svc --> bookings[BookingRepository]
  seats --> db[(DB)]
  bookings --> db
```

| Component | Responsibility | Serves |
|-----------|----------------|--------|
| HTTP API | Request/response, validation | R1–R5 |
| BookingService | Booking transaction, conflict mapping | R1–R3 |
| SeatRepository | Seat reads / availability | R4 |
| BookingRepository | Conditional booking insert | R1–R3 |

## Key Flow — Book a seat

```mermaid
sequenceDiagram
  participant C as Client
  participant S as BookingService
  participant D as DB
  C->>S: POST book(event, seat, user)
  S->>D: INSERT booking (UNIQUE event,seat)
  alt seat free
    D-->>S: ok
    S-->>C: 201 bookingId
  else already booked
    D-->>S: unique violation
    S-->>C: 409 conflict
  end
```

## Conceptual Data Model

```mermaid
erDiagram
  EVENT ||--o{ SEAT : has
  EVENT ||--o{ BOOKING : has
  SEAT  ||--o| BOOKING : "booked by"
```

## G2 — HLD Sign-off
- [x] Every requirement served by a component
- [x] Critical question answered with rationale
- [x] Diagrams consistent
- [x] [SIMULATED] human confirmed shape
