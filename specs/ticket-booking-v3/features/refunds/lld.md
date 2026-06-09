---
artifact: lld
phase: 4
gate: G4
status: signed-off
updated: 2026-06-07
---

# LLD — refunds

**Status:** [SIMULATED] G4 · Run: ticket-booking-v3 · Stack: Java/Spring + Postgres + PSP adapter + Kafka
**Delivers:** cancel a confirmed order within policy, refund it, release the inventory, and restore the purchase limit (R12).

## What this feature does

A buyer cancels a confirmed order (within the refund window/policy). The system refunds via the PSP, marks the order refunded, releases the seats/GA back to inventory, and decrements the buyer's per-event counter so the freed capacity is genuinely re-sellable and the limit is restored.

## Key types
- **RefundController** — `POST /orders/{id}/refund`.
- **RefundService** — checks policy, calls the PSP refund, releases inventory, restores the counter — idempotently.
- **PaymentAdapter.refund(pspRef)** — issues the refund (idempotent).
- **InventoryRepository.release(holdId)** — returns seats/GA to available (reused from `seat-hold`).

## API
```
POST /orders/{orderId}/refund    header: Idempotency-Key   → 200 { status: "refunded" }
  → 409 { error: "outside refund window" }
  → 404 { error: "order not found" }
```

## Concrete data model
### `refunds`
| Field | Type | Key / constraint |
|-------|------|------------------|
| id | uuid | PK |
| order_id | uuid | FK → orders; UNIQUE (one refund per order) |
| amount_cents | bigint | integer minor units |
| psp_ref | text | provider refund reference |
| status | text | requested · refunded · failed |

Also updates: `orders.status → refunded`; releases `hold_seats`/`ga_inventory`; decrements `user_event_counter`.

## Notes
- Idempotent on the order + idempotency key, so a retry never double-refunds.
- Inventory release and counter restore happen in one transaction with the order status change; the PSP refund is recorded and reconciled if the call is slow.
- A released seat re-enters availability and can trigger the **waitlist** (`inventory.released` event).

## G4 — LLD Sign-off
- [x] Idempotent; one refund per order
- [x] Inventory + limit restored atomically; refund reconciled
- [x] Emits the release event the waitlist consumes
- [x] [SIMULATED] human confirmed
