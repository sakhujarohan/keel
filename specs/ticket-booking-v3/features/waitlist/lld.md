---
artifact: lld
phase: 4
gate: G4
status: signed-off
updated: 2026-06-07
---

# LLD — waitlist

**Status:** [SIMULATED] G4 · Run: ticket-booking-v3 · Stack: Java/Spring + Postgres + Kafka
**Delivers:** join a waitlist when sold out and get notified when inventory frees up (R9, R11).

## What this feature does

When an event is sold out, a buyer can join its waitlist. When inventory is released (an expired hold, a refund), the earliest waitlisted buyers are notified that tickets are available again.

## Key types
- **WaitlistController** — `POST /events/{id}/waitlist` to join.
- **WaitlistService** — records the entry (FIFO) and, on a release event, selects the next buyers to notify.
- **ReleaseConsumer** — a Kafka consumer on `inventory.released`; idempotent, so a redelivered release notifies each buyer at most once.

## API
```
POST /events/{eventId}/waitlist   (userId from gateway)   → 201 { position }
```

## Concrete data model
### `waitlist`
| Field | Type | Key / constraint |
|-------|------|------------------|
| id | uuid | PK |
| event_id | bigint | FK → events |
| user_id | text | UNIQUE(event_id, user_id) — no duplicate entries |
| created_at | timestamptz | ordering (FIFO position) |
| notified_at | timestamptz | NULL until notified |

## Notes
- FIFO by `created_at`; "position" is the count of earlier un-notified entries.
- Notification goes through the Notification service (Kafka) — out of band, retried on failure (R11).
- The consumer is idempotent on `(release_event_id, user_id)` so at-least-once delivery doesn't double-notify.

## G4 — LLD Sign-off
- [x] FIFO ordering + idempotent release handling
- [x] Notification is async/retried, not inline
- [x] [SIMULATED] human confirmed
