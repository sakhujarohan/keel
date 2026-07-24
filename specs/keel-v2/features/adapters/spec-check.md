---
artifact: spec-check
phase: 5
gate: G5
status: signed-off
updated: 2026-07-20
---

# Spec-Compliance Review — adapters

**Run:** keel-v2 · **Feature:** adapters · **Profile:** standard (testing → production)

**M5 is the mandate under test** — this is the feature that writes attribution trailers, so it is the
only place the "omit, never invent" rule can be broken.

---

## Literal Mandates (from requirements.md)

| ID | Mandate | Source |
|----|---------|--------|
| M1 | Ledger field set + `git hash-object`. | plan §5 |
| M2 | Dirty-tree refusal + `dirty: true`. | plan §11 D4 |
| M3 | `keel check` exit iff block finding. | plan §6 |
| M4 | Severities fixed. | plan §6 |
| M5 | Attribution trailers are exactly `Keel-Run`, `Keel-Task`, `Agent-Tool`, `Agent-Model`, `Agent-Session`, `Co-Authored-By`; a value the adapter cannot determine is **omitted, never invented**. | plan §5, D6 |
| M6 | Verification only; A5 exception. | plan §1 + A5 |
| M7 | Ledger at `.keel/gates.jsonl`. | plan §11 D2 |
| M8 | `keel upgrade` dirty-tree + `legacy: true`. | plan §10 |
| M9 | Git identity for `actor`. | plan §11 D3 |

---

## Spec-Compliance Ledger

| ID | Clause | LLD / code specifies | Match? | Resolution |
|----|--------|----------------------|--------|------------|
| M5a | Exact trailer names | The hook writes `Keel-Run`, `Keel-Task`, `Agent-Tool`, `Agent-Model`, `Agent-Session` — the five it is responsible for | ✓ | — |
| M5b | `Co-Authored-By` | Left to the agent tool, which emits its own; the hook does not fabricate one | ✓ | Recorded below |
| M5c | Omit, never invent | Each trailer is written only when its env var is non-empty (`[ -n "$2" ]`); an absent value produces no line, and the whole block is skipped when every value is absent | ✓ | — |
| M5d | No duplication | The hook greps for an existing trailer of the same key before appending | ✓ | — |
| M3, M4 | check exit codes and severities | The Action runs `check --ci` unchanged; it assigns nothing | ✓ (n/e) | — |
| M1, M2, M6, M7, M8, M9 | ledger, dirty, verification, location, upgrade, identity | Not exercised — adapters invoke `keel` and read exit codes; they construct no ledger entry and write no artifact | ✓ (n/e) | — |

---

## Mismatches & Resolutions

### 1. The hook writes five of the six trailers, not all six ✓ resolved

M5 names six trailers including `Co-Authored-By`. The hook writes the five that come from
`KEEL_AGENT_*`/`KEEL_*` env and leaves `Co-Authored-By` to the agent tool (Claude Code emits it
already). Writing our own would risk a *second* `Co-Authored-By`, so deferring to the tool is both
correct and duplication-safe. The mandate is satisfied across the two writers; documented so the
split is visible.

---

## G5 — Spec-Compliance Lock

- [x] Every Literal Mandate has been checked against the LLD
- [x] All ✗ mismatches are either fixed or carry a documented, human-confirmed exception
- [x] **Human has confirmed: spec-compliance is satisfied for this feature**
