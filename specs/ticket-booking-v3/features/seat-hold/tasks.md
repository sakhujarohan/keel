---
artifact: tasks
phase: 5
gate: "—"
status: draft
updated: 2026-06-07
---

# Tasks — seat-hold

**Run:** ticket-booking-v3 · **LLD:** `./lld.md`

Status: `[ ]` todo · `[~]` in progress · `[x]` done

## Wave 1 — no dependencies (parallelizable)

### T1 — Create the inventory schema with the no-oversell guard
- **Goal:** Lay down the tables that hold inventory plus the one constraint everything depends on — a single active hold per seat — and the GA counter and per-user limit.
- **Done when:** a migration applies cleanly and the partial-unique index `(event_id, seat_id) WHERE released_at IS NULL` and the `ga_inventory.remaining >= 0` check both exist.
- **Files:** `migrations/` · **Depends on:** — · **Satisfies:** R4, N1

### T2 — Define the domain types and errors
- **Goal:** The `Hold` record and the typed errors (`Unavailable`, `LimitReached`, `NotFound`) so the service and HTTP layers speak one language.
- **Done when:** the package compiles and each error maps to its HTTP status in one place.
- **Files:** `inventory/domain` · **Depends on:** — · **Satisfies:** R4, R5, R8

## Wave 2 — depends on Wave 1

### T3 — Reserved-seat hold (the atomic insert)
- **Goal:** Implement `tryHoldSeats` as the single atomic statement that wins-or-loses each seat, mapping a unique violation to "seat taken".
- **Done when:** unit tests show a free seat is held, a taken seat returns `Unavailable`, and the whole batch rolls back if any one seat is lost.
- **Files:** `inventory/repo` · **Depends on:** T1, T2 · **Satisfies:** R4, R5, N1

### T4 — GA hold + purchase-limit check
- **Goal:** Implement the guarded GA decrement and the per-user counter check.
- **Done when:** unit tests cover a successful GA hold, a sold-out GA (`409`), and a buyer over the limit (`409`); `remaining` never goes negative.
- **Files:** `inventory/repo` · **Depends on:** T1, T2 · **Satisfies:** R4, R8, N1

### T5 — HoldService: all-or-nothing hold with idempotency + expiry
- **Goal:** Orchestrate one hold — limit check, atomic reservation, set `expires_at`, store the idempotency key; a duplicate key returns the original hold.
- **Done when:** service tests pass for happy path, conflict, over-limit, and duplicate-key (same hold returned, none created).
- **Files:** `inventory/service` · **Depends on:** T2 · **Satisfies:** R4, R5, R8, R10

## Wave 3 — depends on Wave 2

### T6 — HTTP endpoints + the expiry sweeper
- **Goal:** Wire `POST /events/{id}/holds` and `DELETE /holds/{id}`, plus the scheduled sweeper that releases expired holds.
- **Done when:** endpoint tests return the right `201/409/404`, release is idempotent, and a sweeper test shows an expired hold's seats become available again.
- **Files:** `inventory/http`, `inventory/sweeper` · **Depends on:** T3, T4, T5 · **Satisfies:** R4, R7, N4

### T7 — The no-oversell race test (the one that proves it)
- **Goal:** Prove the invariant under concurrency, not just assert it — fire many parallel holds at a single seat against a real Postgres.
- **Done when:** with 50 concurrent requests for one seat, exactly one returns `201` and the rest `409`, with exactly one active hold row — deterministically, every run.
- **Files:** `inventory/it` (Testcontainers Postgres) · **Depends on:** T6 · **Satisfies:** N1, N2

---

## Breakdown checklist
- [x] Every task's **Goal** and **Done when** read clearly on their own
- [x] No dependency cycles; no two tasks in a wave touch the same file
- [x] The no-oversell race test (T7) is present — the invariant is proven, not assumed
