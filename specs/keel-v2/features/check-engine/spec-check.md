---
artifact: spec-check
phase: 5
gate: G5
status: draft
updated: 2026-07-21
---

# Spec-Compliance Review — check-engine

**Run:** keel-v2 · **Feature:** check-engine · **Profile:** standard (testing → production)

**M3 and M4 land here** — this is the only feature that assigns severities or produces an exit code, so it is the only place either mandate can be violated.

---

## Literal Mandates (from requirements.md)

| ID | Mandate | Source |
|----|---------|--------|
| M1 | Ledger entries are JSON Lines with exactly the fields `run, gate, event, artifact, artifact_hash, actor, commit, ts` plus optional `dirty`, `legacy`; `artifact_hash` is computed as `git hash-object` of the signed content. | plan §5 |
| M2 | `keel gate pass` MUST refuse on a dirty tree; `--allow-dirty` MUST stamp `dirty: true` into the ledger entry. | plan §11 D4 |
| M3 | `keel check` exits non-zero **iff** ≥ 1 block-severity finding; warn findings MUST NOT affect the exit code. | plan §6 |
| M4 | Rule severities are fixed: KC-01…KC-09 = block; KC-10…KC-13 = warn. | plan §6 table |
| M5 | Attribution trailers are exactly `Keel-Run`, `Keel-Task`, `Agent-Tool`, `Agent-Model`, `Agent-Session`, `Co-Authored-By`; a value the adapter cannot determine is **omitted, never invented**. | plan §5, D6 |
| M6 | The CLI never authors spec or code content — verification only. Sole exception (A5): `gate pass`/`reopen` may write artifact *state* frontmatter. | plan §1 + A5 |
| M7 | The ledger lives at repo level: `.keel/gates.jsonl`, keyed by run. | plan §11 D2 |
| M8 | `keel upgrade` refuses on a dirty tree; backfilled entries MUST carry `legacy: true`. | plan §10 |
| M9 | Gate sign-off identity in v2 is the git identity; `actor` must be upgradeable without a ledger format change. | plan §11 D3 |

---

## Spec-Compliance Ledger

| ID | Clause | LLD specifies | Match? | Resolution |
|----|--------|---------------|--------|------------|
| M3a | Exit non-zero **iff** ≥ 1 block finding | `CheckReport.exitCode` is derived in exactly one place as `blocking > 0 ? 1 : 0`. No rule and no command may set it | ✓ | — |
| M3b | Warns MUST NOT affect the exit code | Warnings are counted separately and never enter the exit expression; a warn-only report is `exitCode: 0` | ✓ | — |
| M3c | The *iff* holds in both directions | Environment failures throw `KeelError` → exit **2**, deliberately outside the 0/1 range, so a crash can never be read as "block findings" nor as "clean" | ✓ | — |
| M3d | A crashing rule must not read as clean | Error model: a rule that throws propagates to exit 2 rather than being swallowed. A silent pass is the one outcome an enforcement tool may not have | ✓ | — |
| M4a | Severities fixed per rule | `CATALOG` is the single ordered table; `Finding.severity` is copied from it, never written at a call site | ✓ | — |
| M4b | KC-01…09 block, KC-10…13 warn | The catalog table in the LLD assigns exactly that split | ✓ | Asserted literally by test (T1) |
| M4c | Thirteen rules, no more, no fewer | `RuleId` is a closed union of KC-01…KC-13 | ✓ | — |
| M5 | Trailer names; omit never invent | KC-13 *reads* trailers; it never writes one, and treats an absent trailer as a finding rather than inferring a value | ✓ (n/e) | — |
| M6 | Verification only | The engine writes nothing at all — no artifacts, no ledger, no state. It is the purest expression of the mandate in the codebase | ✓ | — |
| M1, M2, M7, M8, M9 | ledger format, dirty semantics, location, upgrade, identity | Not exercised: the engine reads `GateStatus` and never constructs, writes or interprets a ledger entry's fields | ✓ (n/e) | — |

---

## Mismatches & Resolutions

### 1. KC-12 is narrowed from its description ⚠ interpretation recorded

**The plan says:** "Self-consistency of the framework docs themselves — phase numbers and versions in `AGENTS.md`/`README` match the manifest."

**Why that cannot ship as written.** It describes a check against *the Keel repository's own documentation*. In a user's repo there is no `AGENTS.md` phase table to compare a manifest against, and matching version claims in prose is guesswork — a warn rule that fires on prose parsing would be noise, and noise in a warn channel is how teams learn to ignore the whole tool.

**Implemented instead as template drift:** `keel.yaml`'s `templates_version` versus the `templates/VERSION` marker written by `init`/`upgrade`, skipping silently when templates are not installed. Same failure class the plan was aiming at — tooling and templates out of step after an upgrade — but mechanical and true in any repository.

**Recommendation:** accept the narrowing. If the original framework-doc check is wanted, it belongs in Keel's own CI as a repo-specific rule, not in the general catalog.

### 2. Three orphaned diagnostics now have a home ✓ resolved

`gate-ledger`'s G5 carried forward that `ledger-line-malformed`, `ledger-entry-invalid` and `ledger-unknown-run` had no rule to surface them. **KC-09 claims them**: if the ledger itself is unreadable, the seal record is unreliable, which is precisely a seal-integrity problem. That obligation is discharged.

### 3. KC-13 requires an additive change to `gate-ledger` — noted, not a divergence

`GitAnchor` gains `recentCommits(limit)` → `{ sha, subject, trailers }`. No existing method changes and no mandate is touched; recorded here so the cross-feature edit is visible rather than discovered in a diff.

---

## G5 — Spec-Compliance Lock

- [ ] Every Literal Mandate has been checked against the LLD
- [ ] All ✗ mismatches are either fixed or carry a documented, human-confirmed exception
- [ ] **Human has confirmed: spec-compliance is satisfied for this feature**

> No tasks are written and no code is built until this gate is signed off.
