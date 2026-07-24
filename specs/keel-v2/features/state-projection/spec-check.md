---
artifact: spec-check
phase: 5
gate: G5
status: signed-off
updated: 2026-07-21
---

# Spec-Compliance Review — state-projection

**Run:** keel-v2 · **Feature:** state-projection · **Profile:** standard (testing → production)

**M6 is the mandate under test here.** This is the only feature that writes into files a human
authored, so it is the only place the verification-only boundary can be crossed.

---

## Literal Mandates (from requirements.md)

| ID | Mandate | Source |
|----|---------|--------|
| M1 | Ledger entries carry exactly the eight fields plus optional `dirty`/`legacy`; `artifact_hash` is `git hash-object` of the signed content. | plan §5 |
| M2 | `keel gate pass` refuses on a dirty tree; `--allow-dirty` stamps `dirty: true`. | plan §11 D4 |
| M3 | `keel check` exits non-zero iff ≥ 1 block finding. | plan §6 |
| M4 | Severities fixed: KC-01…09 block, KC-10…13 warn. | plan §6 |
| M5 | Attribution trailers exactly as named; absent values omitted, never invented. | plan §5, D6 |
| M6 | The CLI never authors spec or code content — verification only. Sole exception (A5): `gate pass`/`reopen` may write artifact *state* frontmatter (`status`, `updated`). | plan §1 + A5 |
| M7 | The ledger lives at `.keel/gates.jsonl`, keyed by run. | plan §11 D2 |
| M8 | `keel upgrade` refuses on a dirty tree; backfilled entries carry `legacy: true`. | plan §10 |
| M9 | Git identity for `actor`, upgradeable without a format change. | plan §11 D3 |

---

## Spec-Compliance Ledger

| ID | Clause | LLD specifies | Match? | Resolution |
|----|--------|---------------|--------|------------|
| M6a | Never authors spec content | Two writes exist. `setArtifactState` replaces the values on the `status:` and `updated:` lines and nothing else — the YAML is not parsed and re-emitted, so comments, key order and every other byte survive | ✓ | — |
| M6b | The exception is *state* fields only | Signature takes `status` and `updated` and offers no way to write anything else; missing keys are an error rather than something to insert, because inserting a key is authoring | ✓ | — |
| M6c | STATUS.md is written too — is that within M6? | `writeStatus` replaces only the **derived** `Now` zone, which the template marks "DERIVED — do not hand-edit". The `## Session log` is copied byte-for-byte and a missing heading aborts the write | ✓ | Recorded below — this is a second write path A5 does not name |
| M1, M2, M7, M9 | ledger format, dirty rules, location, identity | Not exercised: this feature reads `GateStatus` and never touches the ledger | ✓ (n/e) | — |
| M3, M4 | exit codes, severities | Not exercised: no findings, no severities, no exit codes here | ✓ (n/e) | — |
| M5 | trailers | Not exercised | ✓ (n/e) | — |
| M8 | `legacy: true` | Not exercised; `upgrade` will call `setArtifactState` for frontmatter migration, which is why the signature takes an explicit `updated` rather than reading a clock | ✓ (supporting) | — |

---

## Mismatches & Resolutions

### 1. `STATUS.md` is a second write path, and A5 only names frontmatter ⚠ recorded

A5 grants exactly one exception: `gate pass`/`reopen` may write artifact *state* frontmatter. Writing
`STATUS.md` is a **second** kind of write, and the letter of A5 does not mention it.

**Why it is nonetheless within M6's intent.** R9 requires `keel status` to "regenerate the `## Now`
block", so the requirement the human locked already directs this write. The zone is machine-owned by
declaration — `templates/status.md` labels it "DERIVED by /status — do not hand-edit" — and the
human-authored zone (the session log) is copied through untouched, with a missing heading aborting
rather than risking it.

**Recommendation:** accept, and treat the boundary as *"Keel writes only what Keel derives"* rather
than the narrower "frontmatter only". R9 makes this unavoidable; naming it here keeps it a decision
rather than an oversight.

### 2. No clock in this feature — a deliberate constraint on the caller

`setArtifactState` takes `updated` as an argument instead of reading the date itself. That keeps the
feature pure and testable, and it means the timestamp written into frontmatter comes from the same
place as the ledger entry's, so the two can never disagree.

---

## G5 — Spec-Compliance Lock

- [x] Every Literal Mandate has been checked against the LLD
- [x] All ✗ mismatches are either fixed or carry a documented, human-confirmed exception
- [x] **Human has confirmed: spec-compliance is satisfied for this feature**
