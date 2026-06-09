---
artifact: lld
phase: 4
gate: G4
status: signed-off
updated: 2026-06-07
---

# LLD — catalog-search

**Status:** [SIMULATED] G4 · Run: ticket-booking-v3 · Stack: Java/Spring + Elasticsearch (+ read replica)
**Delivers:** browse/search events and read a seat map (R1, R2). Eventually consistent by design (N5) so it stays fast and available while checkout is paced (N6).

## What this feature does

Lets buyers find events (by name, date, venue, city) and view an event's seat map with each seat's status. Search is served from an Elasticsearch index kept up to date asynchronously from the core; seat availability is read from a replica/cache within a freshness SLO.

## Key types
- **CatalogController** — `GET /events` (search), `GET /events/{id}/seatmap`.
- **SearchService** — queries the Elasticsearch event index.
- **SeatMapReader** — returns seat status from a read replica / availability cache.
- **CatalogIndexer** — a Kafka consumer that updates the search index when events/inventory change.

## API
```
GET /events?search=&date=&venue=&city=   → 200 [ { eventId, name, venue, date, availability } ]
GET /events/{eventId}/seatmap            → 200 { seats: [ { seatId, section, row, status } ] }
```

## Data touched
- **Read:** Elasticsearch event index; seat/availability read replica.
- **Write:** none (read-only feature). The index is fed by `CatalogIndexer` from core events.

## Notes
- Seat status may lag the core by the freshness SLO — acceptable; the authoritative check happens at hold time in `seat-hold`.
- If the index is stale/unavailable, fall back to a direct read-replica query for the event.

## G4 — LLD Sign-off
- [x] Read-only; eventual consistency is explicit and acceptable here
- [x] Authoritative availability is enforced later (seat-hold), not here
- [x] [SIMULATED] human confirmed
