---
artifact: tasks
phase: 6
gate: "—"
status: draft
updated: 2026-07-20
---

# Tasks — gate-ledger

**Run:** keel-v2 · **LLD:** `./lld.md` · **Spec-check:** `./spec-check.md` (G5 signed off)

Status: `[ ]` todo · `[~]` in progress · `[x]` done (its check passes)

Six tasks. The dependency shape is a chain with one parallel pair at the start: git access and the event schema are independent, everything else stacks on both. Test-first throughout; integration tests use **real git repositories** in temp dirs, because half of this feature *is* git behaviour.

## Wave 1 — no dependencies (parallelizable, file-disjoint)

### T1 — The ledger entry, as a closed schema
- **Goal:** `GateEvent` in code — the exact eight fields plus optional `dirty`/`legacy`, a zod schema that **rejects unknown keys**, and a serialiser that always emits keys in M1's order so diffs stay readable. Adds the three ledger diagnostic codes to the shared union.
- **Done when:** round-trip tests pass (serialise → parse → identical), an entry with an extra field is rejected as `ledger-entry-invalid`, `dirty`/`legacy` serialise only when true, and the emitted key order is asserted literally against M1.
- **Files:** `packages/core/src/ledger/event.ts`, `packages/core/src/ledger/event.test.ts`, `packages/core/src/model/types.ts` · **Depends on:** — · **Satisfies:** M1
- `[x]` — 12 tests. The closed schema earns its keep: an entry carrying a `feature` field is rejected, which is what stops M1's field set drifting.

### T2 — Git access, and the hash that must equal git's
- **Goal:** `GitAnchor` over `node:child_process`: `isRepository`, `identity`, `headCommit` (null when there are no commits), `treeStatus` with sorted dirty paths, and `hashObjects` computing blob ids natively — with a shell-out fallback for `extensions.objectFormat = sha256`.
- **Done when:** against a real temp git repo, every method returns the right answer, and — **this is a mandate-compliance test, not a nicety (M1d, per spec-check item 1)** — native hashes equal `git hash-object` output for binary, empty, unicode and CRLF files. If this test fails, M1 is violated.
- **Files:** `packages/core/src/anchor/git.ts`, `packages/core/src/anchor/git.test.ts` · **Depends on:** — · **Satisfies:** M1d, M9, R6
- `[x]` — 9 tests. **The mandate test passes:** native blob ids equal `git hash-object` across empty, unicode, CRLF, binary and 200 KB files. Also proved it hashes the *working tree*, not the commit.

## Wave 2 — depends on T1

### T3 — Reading and appending the ledger
- **Goal:** `readLedger` (file order preserved, one bad line diagnosed and skipped without losing the rest, absent file → empty view with no diagnostics) and `appendGateEvent` (single `O_APPEND` write of one line, then `fsync`, creating `.keel/` on demand).
- **Done when:** a ledger with a malformed line still yields its good entries plus one `ledger-line-malformed` carrying the right line number; appending 50 entries concurrently produces 50 whole, parseable lines with none interleaved; `latestFor`/`historyFor` answer correctly for a key that has both a pass and a later reopen.
- **Files:** `packages/core/src/ledger/ledger.ts`, `packages/core/src/ledger/ledger.test.ts` · **Depends on:** T1 · **Satisfies:** M7, N2, R8
- `[x]` — 11 tests, including 50 concurrent appends landing as 50 whole lines, and a ledger whose entries are out of chronological order still resolving by file position.

## Wave 3 — depends on T1, T3

### T4 — Seal state and derived invalidation
- **Goal:** `sealStateFor` (unsealed · sealed · broken · reopened, last-event-wins by file position, never by `ts`) and `gateStatuses`, which computes `blockedBy` from gate order — derived at read time, never stored.
- **Done when:** editing a sealed artifact flips it to `broken` and marks every later gate `blockedBy`; restoring the exact bytes heals all of them with no cleanup; deleting the artifact gives `broken` with `currentHash: null`; a ledger whose entries are written out of chronological order still resolves by file position.
- **Files:** `packages/core/src/ledger/seal.ts`, `packages/core/src/ledger/seal.test.ts` · **Depends on:** T1, T3 · **Satisfies:** R7, R8
- `[x]` — 13 tests. Per-feature independence works: beta's broken LLD does not block alpha's spec-check, but alpha's own broken G4 does.

## Wave 4 — depends on T2, T3, T4

### T5 — The gate operations
- **Goal:** `prepareSeal` / `commitSeal` / `reopenGate` and `GateRefusal`. Prepare gathers and validates but **writes nothing**, so the CLI can print the seal before it exists; commit appends; reopen appends a new event and never rewrites. Every refusal reason from the error model, each with its next action.
- **Done when:** each refusal fires for its own trigger — dirty tree (naming the paths), no commits, missing artifact, no git identity, already sealed at the same hash — and `prepareSeal` provably leaves no file behind in every one of those cases; `--allow-dirty` writes `dirty: true`; the clock is injected so entries are byte-predictable.
- **Files:** `packages/core/src/gate/operations.ts`, `packages/core/src/gate/refusal.ts`, `packages/core/src/gate/operations.test.ts` · **Depends on:** T2, T3, T4 · **Satisfies:** R5, R6, R8, M2, M9
- `[x]` — 13 tests, one per refusal, each asserting no ledger file was left behind. **Found a real bug (LLD amendment 1):** sealing writes `.keel/`, which made the tree dirty, so the *second* gate of any session was always refused.

## Wave 5 — depends on T5

### T6 — End-to-end, in a real repository
- **Goal:** the whole story on real git: seal G1 → edit the sealed file → observe the break and the blocked downstream gates → reopen → re-seal → confirm the full history survived. Plus the append-only property under a reopen-heavy sequence.
- **Done when:** the walkthrough passes against a temp git repo with real commits; the ledger file is byte-inspected to prove earlier lines were never rewritten; and the model + ledger agree on gate state for the `clean` fixture.
- **Files:** `packages/core/test/gate-ledger.integration.test.ts` · **Depends on:** T5 · **Satisfies:** R5, R6, R7, R8, N2
- `[x]` — 3 end-to-end tests on real git repos: seal → break → heal → reopen → re-seal, with the ledger byte-checked to prove earlier lines were never rewritten.

---

## Breakdown checklist
- [x] Every task's **Goal** and **Done when** read clearly on their own (no ID-decoding needed)
- [x] Dependencies form no cycles; no two tasks in a wave touch the same file (only Wave 1 is parallel: `ledger/event.ts` + `model/types.ts` vs. `anchor/git.ts`)
- [x] Each task is small enough that its "Done when" is a single observable check
