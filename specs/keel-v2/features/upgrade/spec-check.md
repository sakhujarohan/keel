---
artifact: spec-check
phase: 5
gate: G5
status: signed-off
updated: 2026-07-21
---

# Spec-Compliance Review — upgrade

**Run:** keel-v2 · **Feature:** upgrade · **Profile:** standard (testing → production)

**M8 lands here.** This feature is also the second writer of ledger entries (after gate-ledger), so
M1's field set is exercised again.

---

## Literal Mandates (from requirements.md)

| ID | Mandate | Source |
|----|---------|--------|
| M1 | Ledger entries carry exactly the eight fields plus optional `dirty`/`legacy`; `artifact_hash` is `git hash-object`. | plan §5 |
| M2 | `gate pass` dirty-tree rules. | plan §11 D4 |
| M3 | check exit codes. | plan §6 |
| M4 | Severities fixed. | plan §6 |
| M5 | Attribution trailers. | plan §5, D6 |
| M6 | Verification only; A5 exception. | plan §1 + A5 |
| M7 | Ledger at `.keel/gates.jsonl`. | plan §11 D2 |
| M8 | `keel upgrade` refuses on a dirty tree; backfilled entries MUST carry `legacy: true`. | plan §10 |
| M9 | Git identity for `actor`. | plan §11 D3 |

---

## Spec-Compliance Ledger

| ID | Clause | LLD specifies | Match? | Resolution |
|----|--------|---------------|--------|------------|
| M8a | Refuses on a dirty tree | Step 1 is a clean-tree guard → `GateRefusal{dirty-tree}`, nothing written | ✓ | — |
| M8b | Backfilled entries carry `legacy: true` | The backfill appends `GateEvent` with `legacy: true`; documented as "claims to have been signed" honesty | ✓ | — |
| M1a | Backfill uses the exact field set | The backfilled entry is a `GateEvent` — the same closed schema gate-ledger validates on read; `legacy` is the sanctioned optional field | ✓ | — |
| M1b | `git hash-object` | Backfill hashes the current file via the anchor, after the frontmatter bump, so the seal holds | ✓ | — |
| M6 | Verification only; A5 exception | Frontmatter writes touch only `schema_version` (a state field, like `status`/`updated`); prose is never re-serialised | ✓ | Recorded below |
| M7 | Ledger location | Appends via the same `appendGateEvent` — `.keel/gates.jsonl` | ✓ | — |
| M9 | Git identity | `actor` from the anchor's identity; refuses (via the ledger op's own guard) rather than inventing | ✓ | — |
| M2, M3, M4, M5 | dirty stamp, check exit, severities, trailers | Not exercised | ✓ (n/e) | — |

---

## Mismatches & Resolutions

### 1. `schema_version` is a fourth state field the frontmatter writer touches ⚠ recorded

state-projection's G5 established that Keel writes only `status`/`updated` state frontmatter (A5).
`upgrade` also writes `schema_version`. This is consistent with the same principle — `schema_version`
is machine-owned bookkeeping, not authored content, and R13 explicitly requires bumping it. The
boundary agreed at state-projection's G5 ("Keel writes only what Keel derives/owns") already covers
it; recording so the additional field is a decision, not a silent expansion.

### 2. A legacy entry seals real content with a historical claim

The hash and commit in a backfilled entry are computed now and are real; only the *sign-off event*
is historical, which `legacy: true` marks. This is the honest position (N5): Keel records that a v1
artifact claims a sign-off it cannot witness, rather than manufacturing a verified one.

---

## G5 — Spec-Compliance Lock

- [x] Every Literal Mandate has been checked against the LLD
- [x] All ✗ mismatches are either fixed or carry a documented, human-confirmed exception
- [x] **Human has confirmed: spec-compliance is satisfied for this feature**
