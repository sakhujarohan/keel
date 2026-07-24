---
artifact: spec-check
phase: 5
gate: G5
status: signed-off
updated: 2026-07-19
---

# Spec-Compliance Review — run-model

**Run:** keel-v2 · **Feature:** run-model · **Profile:** standard (testing → production)

> **Re-confirmed 2026-07-20** after the LLD's Amendment 1 (Section gains `bullets` + `text`; tasks parsed as headings, not a table). Re-checked all nine mandates against the amended design: the amendment changes *how markdown structure is read* and touches no status code, field set, format, or protocol constraint. Every verdict below stands unchanged.

`run-model` is the read-only foundation — several mandates are exercised by later features (ledger, adapters, migrator), not this one. For those, the check below verifies the LLD **does not contradict** the mandate and leaves nothing that would force a violation downstream.

---

## Literal Mandates (from requirements.md)

| ID | Mandate | Source |
|----|---------|--------|
| M1 | Ledger entries are JSON Lines with exactly the fields `run, gate, event, artifact, artifact_hash, actor, commit, ts` plus optional `dirty`, `legacy`; `artifact_hash` is computed as `git hash-object` of the signed content. | plan §5 |
| M2 | `keel gate pass` MUST refuse on a dirty tree; `--allow-dirty` MUST stamp `dirty: true` into the ledger entry. | plan §11 D4 |
| M3 | `keel check` exits non-zero **iff** ≥ 1 block-severity finding; warn findings MUST NOT affect the exit code. | plan §6 |
| M4 | Rule severities are fixed: KC-01…KC-09 = block; KC-10…KC-13 = warn. | plan §6 table |
| M5 | Attribution trailers are exactly `Keel-Run`, `Keel-Task`, `Agent-Tool`, `Agent-Model`, `Agent-Session`, `Co-Authored-By`; a value the adapter cannot determine is **omitted, never invented**. | plan §5, D6 |
| M6 | The CLI never authors spec or code content — verification only. Sole exception (A5, confirmed): `gate pass`/`reopen` may write artifact *state* frontmatter fields (`status`, `updated`). | plan §1 + A5 |
| M7 | The ledger lives at repo level: `.keel/gates.jsonl`, keyed by run. | plan §11 D2 |
| M8 | `keel upgrade` refuses on a dirty tree; backfilled entries MUST carry `legacy: true`. | plan §10 |
| M9 | Gate sign-off identity in v2 is the git identity; the `actor` field must be upgradeable to a verified identity without a ledger format change. | plan §11 D3 |

---

## Spec-Compliance Ledger

| Mandate ID | Mandate (short) | LLD specifies | Match? | Resolution |
|------------|-----------------|---------------|--------|------------|
| M1 | Exact ledger fields; `git hash-object` | Not exercised — the loader neither reads nor writes the ledger. Consistency note: the LLD deliberately keeps hashing out of the loader ("loader carries paths, not bytes; hashing is the anchor's job"), which preserves M1's hash-object requirement for the gate-ledger feature rather than duplicating it. | ✓ (n/e) | — |
| M2 | Dirty-tree refusal + `dirty: true` | Not exercised — no git interaction in the loader (Concurrency notes: "no git"). Nothing constrains or contradicts the ledger's dirty-tree behavior. | ✓ (n/e) | — |
| M3 | Exit ≠ 0 iff block findings; warns never affect exit | Directly supported: the two-channel error model routes content problems to `Diagnostic` values (severity assigned later by rules, feeding exit 1) and environment failures to `KeelError` → exit 2. The loader assigns **no severities and no exit codes**, so it cannot violate the iff. | ✓ | — |
| M4 | Severities fixed in one table | Consistent by omission: `Diagnostic` carries `code`, not severity — severity mapping stays in `rules/catalog.ts` (check-engine feature). The LLD introduces no second severity source. | ✓ | — |
| M5 | Exact trailer names; omit, never invent | Not exercised — trailers are the adapters feature. The loader parses no commits. | ✓ (n/e) | — |
| M6 | Verification only; sole exception = state frontmatter on gate events | **Directly checked:** the loader is read-only end-to-end — "The loader takes no writes," model returned immutable/deep-frozen, discovery never creates files. It does not even use the A5 exception. | ✓ | — |
| M7 | Ledger at `.keel/gates.jsonl` | Not exercised — no ledger access. The discovery table routes only `keel.yaml`, `specs/**`, and feature files; `.keel/` is untouched by the loader, leaving the location contract wholly to gate-ledger. | ✓ (n/e) | — |
| M8 | Upgrade: dirty-tree refusal; `legacy: true` | Supporting detail present: `schema_version` absent → `1` is the LLD's v1-detection rule, which is exactly what the migrator needs to find upgrade candidates. No upgrade behavior is specified here, so nothing to contradict. | ✓ | — |
| M9 | Git identity for `actor`; format upgradeable | Not exercised — no identity handling in the loader. | ✓ (n/e) | — |

*(✓ (n/e) = mandate not exercised by this feature; verified non-contradicting.)*

---

## Mismatches & Resolutions

_None — all mandates satisfied._

---

## G5 — Spec-Compliance Lock

- [x] Every Literal Mandate has been checked against the LLD (M1–M9: 4 exercised ✓, 5 verified non-contradicting)
- [x] All ✗ mismatches are either fixed (G4 re-confirmed) or carry a documented, human-confirmed exception — zero ✗
- [x] **Human has confirmed: spec-compliance is satisfied for this feature** — Rohan, 2026-07-19 (via `/tasks` advance)

> No tasks are written and no code is built until this gate is signed off.
