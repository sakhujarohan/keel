---
artifact: tasks
phase: 6
gate: "—"
status: draft
updated: 2026-07-21
---

# Tasks — check-engine

**Run:** keel-v2 · **LLD:** `./lld.md` · **Spec-check:** `./spec-check.md` (G5 signed off)

Status: `[ ]` todo · `[~]` in progress · `[x]` done (its check passes)

Six tasks. The catalog and context come first because every rule depends on both; the rules then land in three parallel groups split by what they read, and the engine assembles them.

## Wave 1 — no dependencies

### T1 — The catalog, the finding, and the exit policy
- **Goal:** `Finding`, `Severity`, `RuleId`, the `CATALOG` skeleton (thirteen entries with their severities and descriptions), and `report()` — the single place an exit code is computed.
- **Done when:** a test asserts the severity split literally (KC-01…09 block, KC-10…13 warn, thirteen rules exactly); a report of warnings only exits 0; one block finding exits 1; findings sort by path → line → rule.
- **Files:** `packages/core/src/check/catalog.ts`, `packages/core/src/check/report.ts`, `packages/core/src/check/report.test.ts` · **Depends on:** — · **Satisfies:** M3, M4
- `[ ]`

## Wave 2 — depends on T1

### T2 — The rule context
- **Goal:** `buildContext` — load model, ledger, artifact hashes and gate statuses once, deep-freeze the result, and load commits only when asked. Adds `recentCommits` to `GitAnchor`.
- **Done when:** a context built over the `clean` fixture exposes model, ledger and gates consistently; mutating it throws; `needCommits: false` performs no git-log call (asserted with a spy anchor).
- **Files:** `packages/core/src/check/context.ts`, `packages/core/src/check/context.test.ts`, `packages/core/src/anchor/git.ts` · **Depends on:** T1 · **Satisfies:** R3, N1
- `[ ]`

## Wave 3 — depends on T2 (three groups, file-disjoint)

### T3 — Structure rules: KC-01, KC-04, KC-05, KC-06
- **Goal:** the rules that read the model alone — loader diagnostics surfaced as findings, mandates declared, every requirement delivered by some feature, every declared feature carrying an LLD.
- **Done when:** each rule fires on the fixture built to trip it and stays silent on `clean`; each message names the offending ID and the next action.
- **Files:** `packages/core/src/check/rules/structure.ts`, `packages/core/src/check/rules/structure.test.ts` · **Depends on:** T2 · **Satisfies:** R3
- `[ ]`

### T4 — Gate rules: KC-02, KC-03, KC-09
- **Goal:** the rules that read gate state — phase order, assumptions still `proposed` after G1 is sealed, and seal integrity (including the three ledger diagnostics, per spec-check item 2).
- **Done when:** an `hld.md` present while G1 is unsealed is a block finding; a `proposed` assumption under a sealed G1 is a block finding; a broken seal and a `blockedBy` gate both surface through KC-09; a mangled ledger line surfaces there too.
- **Files:** `packages/core/src/check/rules/gates.ts`, `packages/core/src/check/rules/gates.test.ts` · **Depends on:** T2 · **Satisfies:** R7, M4
- `[ ]`

### T5 — Traceability rules: KC-07, KC-08, KC-10, KC-11, KC-12, KC-13
- **Goal:** mandate coverage in spec-checks, the task graph (missing DoD, unknown dependency, cycles, same-file collisions in a wave), STATUS projection drift, dangling IDs, template drift, and commit attribution.
- **Done when:** a task depending on an unknown task, two tasks in one wave declaring the same file, and a dependency cycle each produce their own finding; a dangling requirement ID in a `delivers` cell is flagged; a commit with no attribution trailer is flagged while one with `Agent-Model` is not.
- **Files:** `packages/core/src/check/rules/traceability.ts`, `packages/core/src/check/rules/traceability.test.ts` · **Depends on:** T2 · **Satisfies:** R3, M4
- `[ ]`

## Wave 4 — depends on T3, T4, T5

### T6 — The engine, the hook path, and dogfooding
- **Goal:** `runChecks` over the catalog, `requireGate` for the hook, and the A6 handling of a repo with no manifest. Then point the whole thing at this repository and record what it finds.
- **Done when:** every fixture produces a stable snapshot of findings; a repo with no `keel.yaml` exits 0 while `--strict` exits 2; a rule that throws surfaces as exit 2 rather than a clean report; `requireGate` returns 0 for a sealed gate and 1 with a next action for an unsealed one; and **the engine's findings against `specs/keel-v2` are recorded below, honestly, including the ones about our own artifacts.**
- **Files:** `packages/core/src/check/engine.ts`, `packages/core/src/check/engine.test.ts`, `packages/core/test/check-engine.golden.test.ts` · **Depends on:** T3, T4, T5 · **Satisfies:** R3, R4, M3, A6
- `[ ]`

---

## Breakdown checklist
- [x] Every task's **Goal** and **Done when** read clearly on their own (no ID-decoding needed)
- [x] Dependencies form no cycles; no two tasks in a wave touch the same file (Wave 3's three rule files are disjoint)
- [x] Each task is small enough that its "Done when" is a single observable check
