---
artifact: requirements
phase: 1
gate: G1
status: signed-off
updated: 2026-06-07
---

# Requirements — ticket-booking

**Status:** LOCKED ([SIMULATED] G1 signed off for dry run)
**Run:** ticket-booking · **Profile:** standard

## Problem

Users browse events and book individual seats. The hard requirement is correctness under concurrency: a seat must never be sold twice, even when many users target it simultaneously.

## Functional Requirements

| ID | Requirement (EARS) | Acceptance criteria |
|----|--------------------|---------------------|
| R1 | When a user requests an available seat for an event, the system shall create a confirmed booking for that user and seat. | Booking row exists; seat reads as booked; 201 returned. |
| R2 | If a user requests a seat that is already booked, then the system shall reject the request with a conflict. | No new booking; 409 returned. |
| R3 | When multiple users concurrently request the same available seat, the system shall confirm exactly one and reject the rest. | Exactly one 201; all others 409; exactly one booking row. |
| R4 | When a user requests the seat map for an event, the system shall return each seat with its availability. | Response lists seats with status. |
| R5 | If a user requests a seat or event that does not exist, then the system shall reject with not-found. | 404 returned. |

## Non-Functional Requirements

| ID | Concern | Requirement | Source |
|----|---------|-------------|--------|
| N1 | Concurrency / correctness | No double-booking under concurrent requests (the dominant requirement). | stated |
| N2 | Durability | A confirmed booking survives process/DB restart. | inferred |
| N3 | Latency | A single booking responds in < ~200ms under modest load. | UNKNOWN — assume modest for v1 |

## Constraints

- Greenfield; no mandated stack.

## Out of Scope (explicit)

- Payments, pricing, refunds.
- Seat holds / reservation timeouts — booking is one-step in v1.
- Waitlists, group bookings, seat recommendations.
- Authentication/authorization — assume an upstream gateway supplies a trusted `userId`.

## Open Questions

- [x] Hold-then-confirm vs. one-step book? → **one-step** for v1 (holds are out of scope).
- [x] User-selected vs. auto-assigned seats? → **user-selected**.

## G1 — Requirements Lock
- [x] Design-changing questions resolved
- [x] Out-of-scope explicit
- [x] Every requirement has an ID + acceptance criteria
- [x] [SIMULATED] human confirmed complete and stable
