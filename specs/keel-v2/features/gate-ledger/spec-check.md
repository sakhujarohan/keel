---
artifact: spec-check
phase: 5
gate: G5
status: signed-off
updated: 2026-07-20
---

# Spec-Compliance Review — gate-ledger

**Run:** keel-v2 · **Feature:** gate-ledger · **Profile:** standard (testing → production)

This is the mandate-bearing feature: **M1, M2, M7 and M9 land squarely here**, and M6 is directly exercised. Where `run-model` could only be checked for non-contradiction, every clause below is diffed against concrete design text.

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

| ID | Clause | LLD specifies | Match? | Resolution |
|----|--------|---------------|--------|------------|
| M1a | JSON Lines format | `.keel/gates.jsonl`, one `GateEvent` per `\n`-terminated line; example lines given in the data model | ✓ | — |
| M1b | Exactly these eight fields | `GateEvent` declares `run, gate, event, artifact, artifact_hash, actor, commit, ts` and nothing else; read-side schema is **closed** — unknown keys raise `ledger-entry-invalid` | ✓ | — |
| M1c | Optional `dirty`, `legacy` | Both declared `?: true`, "present only when true; never `false`" — stricter than the mandate, compatible with it | ✓ | — |
| M1d | `artifact_hash` "computed as `git hash-object`" | Computed **natively** as `sha1("blob " + len + "\0" + bytes)`; equality with real `git hash-object` output is enforced by test over binary/empty/unicode/CRLF fixtures; sha256 repos shell out to git | ⚠ | **Interpretation recorded — see item 1 below.** Needs human confirmation |
| M1e | "of the signed content" | Hashes the artifact as it sits in the **working tree** (per ADR 0002), which is the content being signed | ✓ | — |
| M1f | `commit` field present | Always written from `HEAD`; sealing is **refused** in a repo with no commits rather than writing `""` (resolution of item 2) | ✓ | — |
| M2a | MUST refuse on a dirty tree | Error model row 2: `GateRefusal{reason:"dirty-tree", dirtyPaths}`, exit 2, nothing written; message lists the dirty paths | ✓ | — |
| M2b | `--allow-dirty` MUST stamp `dirty: true` | Error model row 3: proceeds and writes `dirty: true`; the flag cannot produce a silent exception | ✓ | — |
| M3 | Exit non-zero iff block findings (scoped to `keel check`) | This feature assigns **no severities and no exit codes**. It exposes `SealState`; the check engine turns a `broken` seal into KC-09. `GateRefusal` exits belong to `keel gate`, a different command, so the iff is untouched | ✓ | — |
| M4 | Severities fixed in one table | No severity appears anywhere in this feature. Its three new **diagnostic codes** carry codes only | ✓ | **Follow-up for check-engine — see item 3** |
| M5 | Trailer names; omit never invent | Not exercised — no commit authoring here. Consistent in spirit: `no-identity` refuses rather than inventing an `actor` (N5) | ✓ (n/e) | — |
| M6 | Never authors spec or code content | Writes exactly two things: the ledger (Keel's own record, not spec or code) and `.keel/`. Explicitly defers the frontmatter projection to `state-projection` — it does not even use the A5 exception | ✓ | — |
| M7a | Ledger at `.keel/gates.jsonl` | `export const LEDGER_PATH = ".keel/gates.jsonl"` — single constant, repo-level | ✓ | — |
| M7b | "keyed by run" | Every entry carries `run`; `keysFor(run)` and `SealKey{run, gate, artifact}` scope all reads. **G4/G5 repeat per feature and are keyed by `artifact`, not by a new field** — M1's field set stays closed | ✓ | — |
| M8 | `legacy: true` on backfilled entries | Schema declares `legacy?: true` and reserves it for `keel upgrade`; the dirty-tree refusal for `upgrade` belongs to that feature | ✓ (supporting) | — |
| M9a | Git identity for `actor` | `GitAnchor.identity()` → `"Name <email>"` from git config; documented as asserted, not authenticated | ✓ | — |
| M9b | Upgradeable without a format change | `actor` is an opaque string; a verified identity replaces its *content*, not the schema. No consumer parses it | ✓ | — |

---

## Mismatches & Resolutions

### 1. M1d — "computed as `git hash-object`": which reading? ⚠ needs confirmation

**The tension.** The mandate names a command. The LLD computes the value natively instead of spawning `git hash-object`.

- **Reading A (the value):** the mandate fixes *what the hash is* — the git blob id. Native computation satisfies it, because the output is provably identical.
- **Reading B (the mechanism):** the mandate fixes *how the hash is obtained*. Then computing it natively is a divergence, however identical the result.

**Why the LLD chose A.** The value is the same by construction (`sha1("blob " + len + "\0" + bytes)` is the definition of a git blob id), verified against real `git hash-object` output in a test that runs over binary, empty, unicode and CRLF fixtures, plus a sha256 fallback that shells out. The driver is the measured N3 finding in `run-model`: process spawns are the expensive thing on the hook path, and `check --require` hashes on every intercepted tool call.

**Recommendation:** accept Reading A, recorded here as a deliberate, tested interpretation rather than an unexamined ✓. If you prefer Reading B, the change is small and local (`hashObjects` always shells out) — but it puts a subprocess back on the hot path.

**Resolved 2026-07-20 — Reading A accepted by Rohan.** The equality test against real `git hash-object` is therefore a *mandate-compliance* test, not a nicety: if it ever fails, M1 is violated. It is called out as such in `tasks.md` T2.

### 2. `commit: ""` in a repository with no commits — a weak anchor, not a mandate breach

M1 requires the `commit` field to exist; it does not require it to be non-empty. The LLD allows `""` when `HEAD` has no commit yet. That is *compliant* but weak: a seal anchored to no commit cannot be located in history later, which is most of what makes the anchor worth having.

**Recommendation:** refuse to seal in a repository with zero commits (`GateRefusal{reason:"no-commit"}`, "make an initial commit, then seal"). One row in the error model, one enum value — but it is a G4 change, so it is listed here rather than applied.

**Resolved 2026-07-20 — recommendation applied by Rohan.** The LLD now carries the `no-commit` refusal reason, the error-model row, and `headCommit(): Promise<string | null>`. G4 amended and re-confirmed in the same pass; clause M1f above records the result.

### 3. Three new diagnostic codes have no rule mapping yet — a gap to carry forward

This feature adds `ledger-line-malformed`, `ledger-entry-invalid` and `ledger-unknown-run` to the shared `DiagCode` union. No KC rule currently claims them, so today they would be produced and never surfaced. Not a mandate violation and not this feature's defect — but the **check-engine LLD must map each to a rule** (KC-01 or KC-09 are the natural homes) or they are dead weight. Recorded as a required input to that feature's G4.

---

## G5 — Spec-Compliance Lock

- [x] Every Literal Mandate has been checked against the LLD — 18 clauses, no ✗
- [x] All ✗ mismatches are either fixed (G4 re-confirmed) or carry a documented, human-confirmed exception — item 1 accepted as a recorded interpretation, item 2 fixed in the LLD (G4 amended + re-confirmed), item 3 carried forward to check-engine's G4
- [x] **Human has confirmed: spec-compliance is satisfied for this feature** — Rohan, 2026-07-20

> No tasks are written and no code is built until this gate is signed off.
