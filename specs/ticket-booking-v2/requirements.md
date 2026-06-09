---
artifact: requirements
phase: 1
gate: G1
status: signed-off
updated: 2026-06-07
---

# Requirements — ticket-booking-v2

**Status:** LOCKED ([SIMULATED] G1) · **Profile:** production

## Problem

Build the backend for an **event-ticketing platform** that sells tickets for live events (concerts, sports, theatre) across many venues. Users browse events, pick seats (reserved seating from a venue seat map) or a quantity (general admission), and check out.

The system is defined by its hardest moment: the **on-sale**. When a popular event opens, tens of thousands of users arrive within the same few seconds, all competing for the same limited inventory. The platform must **never oversell a seat or exceed capacity**, must stay **responsive** under that load, and must hold inventory fairly while a buyer completes payment through an external provider that can be slow or fail.

Inventory is **reserved-seating** (named seats) and **general admission** (a capacity counter). Checkout is **hold-then-pay**: a buyer holds their selection for a short window, pays, and the order confirms; abandoned or expired holds release inventory. Sold-out events offer a **waitlist**. Per-user **purchase limits** and a **virtual waiting room** curb bots and hoarding.

## Functional Requirements

| ID | Requirement (EARS) | Acceptance criteria |
|----|--------------------|---------------------|
| R1 | The system shall let a user browse and search events by name, date, venue, and city. | Search returns matching events with an availability state. |
| R2 | When a user opens an event's seat map, the system shall return each seat's status (available / held / sold). | Seat map reflects current inventory within the freshness SLO. |
| R3 | When an event is on-sale and under load, the system shall admit users through a **virtual waiting room** that caps concurrent checkout to a safe rate. | Admitted users get a time-boxed token; others wait with a position. |
| R4 | When an admitted user selects available seats (reserved) or a quantity (GA), the system shall place a **hold** on that inventory for a fixed TTL and start checkout. | Held inventory is unavailable to others; the hold has an expiry. |
| R5 | If a user attempts to hold inventory that is no longer available, then the system shall reject the hold with a conflict and the current state. | 409; no partial hold. |
| R6 | While a hold is active, the system shall let the user pay via the external PSP and, on success, **confirm** the order and issue tickets. | Order confirmed exactly once; tickets issued; inventory marked sold. |
| R7 | If payment fails, times out, or the hold expires before payment, then the system shall **release** the held inventory. | Inventory returns to available; no charge stands. |
| R8 | The system shall enforce a **per-user purchase limit** per event. | Holds/orders beyond the limit are rejected. |
| R9 | When an event is sold out, the system shall let a user **join a waitlist** and shall notify waitlisted users when inventory is released. | Waitlist entry recorded; notification on release. |
| R10 | The system shall make hold, pay, and confirm **idempotent** under client retries. | A retry with the same idempotency key yields the same result — no double-hold, no double-charge. |
| R11 | When an order is confirmed or a refund processed, the system shall notify the user (email/SMS). | Notification dispatched; failures retried out of band. |
| R12 | The system shall let a user cancel a confirmed order within policy and process a **refund**, releasing inventory. | Refund initiated; inventory released; purchase limit restored. |

## Non-Functional Requirements

| ID | Concern | Requirement | Source |
|----|---------|-------------|--------|
| N1 | Correctness (the hard invariant) | The system MUST NEVER oversell: no seat sold twice; GA sales never exceed capacity — even under tens of thousands of concurrent buyers across multiple instances. | stated |
| N2 | Concurrency / scale | Sustain a hot-event on-sale: ~50,000 checkout attempts/minute for a single event without overselling or collapsing. | stated |
| N3 | Latency | Under on-sale load, p99 for a hold operation < 500 ms for admitted users. | inferred |
| N4 | Hold integrity | Holds expire within a bounded skew of their TTL and reliably release inventory, even across process crashes. | stated |
| N5 | Consistency model | Inventory & orders strongly consistent; catalog/search and notifications may be eventually consistent. | inferred |
| N6 | Availability / degradation | The waiting room sheds and paces load so the core never tips over; browse/search stays available even when checkout is throttled. | stated |
| N7 | Durability | A confirmed order and its payment outcome survive process/datastore restart. | inferred |
| N8 | Exactly-once money | No double-charge, no double-issue — under client retries and at-least-once messaging. | stated |
| N9 | Security / abuse | Per-user limits + rate limiting + the waiting room mitigate bots and hoarding. | stated |

## Performance Targets

| Metric | Target | Achieved |
|--------|--------|----------|
| Oversell rate | **0** (hard invariant) | <filled at review> |
| On-sale throughput (1 event) | ≥ 50k checkout attempts / min | |
| p99 hold latency (admitted) | < 500 ms | |
| Hold-expiry skew | < 5 s past TTL | |
| Waiting-room admission | paced to keep the core < 70% saturation | |

## Constraints

- Greenfield; no mandated stack.
- Card data is handled entirely by the external **PSP** — the platform never stores PANs.

## Assumptions

- Auth is handled upstream; an API gateway supplies a trusted `userId`.
- Single region for v1 (multi-region is out of scope).
- Venue seat maps are pre-loaded before on-sale (no live seat-map editing during a sale).
- The PSP exposes idempotent authorize/capture and asynchronous webhooks.

## Out of Scope (explicit)

- Secondary market / resale and ticket transfers.
- Dynamic / surge pricing (v2) — v1 uses fixed price tiers.
- Fraud-detection ML and KYC.
- Multi-region / active-active and disaster recovery.
- Native mobile clients (API only).

## Open Questions

- [x] Reserved-seating AND general-admission in v1? → **both**.
- [x] Queue strategy? → **virtual waiting room** issuing time-boxed admission tokens.
- [x] Hold TTL? → **10 minutes**, configurable per event.
- [x] Payment sync or async? → **authorize synchronously, confirm on webhook**, with a timeout-driven release.

## G1 — Requirements Lock
- [x] Design-changing questions resolved
- [x] Out-of-scope explicit · assumptions stated
- [x] Every requirement has an ID + acceptance criteria
- [x] [SIMULATED] human confirmed complete and stable
