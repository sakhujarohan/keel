# Run Status — keel-v2

## Now
<!-- DERIVED by keel status — do not hand-edit. Glyphs: ✓ sealed · ▶ reopened · ⚠ broken · — not reached. -->

- **Phase:** 5 / 8 — Spec-Compliance Review
- **Gates:** G1 ✓ (2026-07-20) · G2 ✓ (2026-07-20) · G3 ✓ (2026-07-20) · G4 ✓ (2026-07-20) · G5 ✓ (2026-07-20) · G6 —
- **Tasks:** 31 / 31 done
- **Next action:** Produce and confirm the artifact for G6, then run: keel gate pass G6 --run keel-v2

## Session log
<!-- Append-only, newest on top. /handoff prepends one entry per work session. -->

### 2026-07-21 — all seven features built; Keel enforces itself; at G6
- **Did:** Built the remaining four features — state-projection, scaffold + the `@keel-dev/cli` binary, adapters, upgrade — plus a red-flag pass (a genuinely fast `requireGateFast` hook path, KC-13 path-scoping). 219 tests. **Keel v2 now passes its own `keel check` at 0 blocking findings**, sealing its own gates with its own tooling.
- **Decisions / gotchas:** The deepest bug of the whole build, found only by driving the real CLI end-to-end: **sealing wrote `status: signed-off` into the artifact, which broke the seal it had just made** (ADR 0002 verifies the working tree; A5 writes frontmatter). Fixed by hashing the *post-sign* content — a seal and its projection are now a pair sharing one transform (`model/frontmatter-state.ts`), recorded as gate-ledger amendment 2. The commit hook aborted commits when a trailer value was empty (missing `exit 0`) — caught by the hook test. **N3 resolved:** bundled hook path cold-starts ~55 ms, 9× under the 500 ms budget; the ~750 ms `tsx` figure was on-the-fly compilation, not the shipped path — ADR 0001's escape hatch not needed.
- **Verified:** `examples/ticket-booking` migrates with `keel upgrade` — 12 artifacts to v2, 9 legacy gates, zero manual edits, no seal break (R13's acceptance test, on the real example).
- **Next:** **G6 — Ship review.** The review checklist (`review-checklist.md`) is complete and holds the ledgers, the measured N3, and a 10-item v2.0.x patch list. Awaiting the human's ship confirmation; then `keel gate pass G6`. First v2.0.0 (non-alpha) task: wire `tsup` and `npm publish`.

### 2026-07-21 — check-engine built, and Keel sealed its own gates
- **Did:** Phase 4→7 for `check-engine`: all thirteen KC rules, the pure-rule architecture (context loaded once and deep-frozen), the narrow `requireGate` hook path, and A6 handling. Then pointed it at this repository. **Keel v2 now enforces this run.**
- **Decisions / gotchas:** Two G5 interpretations recorded — KC-12 narrowed from "framework docs self-consistency" (unimplementable in a general repo) to **template drift**, and KC-09 adopts the three orphaned ledger diagnostics, discharging gate-ledger's carried-forward obligation. Dogfooding found **two bugs in my own rules**: KC-11 rejected mandate IDs (work legitimately traces to them), and `parseIdList` read `R8 (M1, M2)` as a token called `R8 (M1`, making delivered requirements look orphaned. Both fixed.
- **The result worth remembering:** the first self-check reported 19 blocking findings, 11 of them KC-02 — *artifacts existing while their gates were unsealed*. Every gate in this run had been signed in conversation with nothing behind it, which is the exact failure v2 was built to prevent. Sealing them with the real `prepareSeal`/`commitSeal` took it to **4 blocking, 6 warnings** — and those remaining are all true: four features designed but not yet built, and six v1-era commits that predate D6.
- **Next:** `state-projection` (`keel status`, the frontmatter projection), then `scaffold` (`init`, `run new`, `doctor`), `adapters`, `upgrade`. After that the `cli` package, which is also what finally allows the cold-start latency measurement that N3 still carries as UNKNOWN.

### 2026-07-20 — gate-ledger built: 6 tasks, 134 tests total, seals working end-to-end
- **Did:** Phase 7 for `gate-ledger`. Keel can now actually seal a gate: `GitAnchor` (the only door to git), the append-only ledger, seal state with derived downstream invalidation, and `prepareSeal`/`commitSeal`/`reopenGate` with a refusal for every way the environment can fail. Verified end-to-end against real git repos — seal → break → heal → reopen → re-seal, with the ledger byte-checked to prove nothing was rewritten.
- **Decisions / gotchas:** **LLD amendment 1, found by a test:** sealing writes `.keel/`, which dirties the tree, so the *second* gate of any session was always refused — the first seal poisoned the next. The dirty check now exempts Keel's own directory (git reports it as `.keel/` while untracked, so the test is by prefix). The M1 mandate test passes: native blob ids equal `git hash-object` across empty/unicode/CRLF/binary/200 KB inputs — that test is what holds us to the mandate now that we don't spawn git. Two test-harness traps worth remembering: `git config --unset user.email` falls through to the developer's *global* config (set it empty instead), and per-feature gate fixtures must include G3 or `blockedBy` correctly reports it.
- **Next:** `check-engine` — it consumes both built features and must map the three orphaned ledger diagnostic codes to KC rules (carried from gate-ledger's G5).

### 2026-07-20 — gate-ledger designed through G5; 6 tasks ready to build
- **Did:** `/lld`, `/spec-check` and `/tasks` for **gate-ledger**. G4 and G5 both signed. The spec-check diffed M1 into six separate clauses (18 in total) rather than one row — worth it: it surfaced three items.
- **Decisions / gotchas:** (1) **M1's "computed as `git hash-object`" reads as the *value*, not the mechanism** — hashes are computed natively (verified identical to git; the equality test is now a mandate-compliance test, so a failure means M1 is violated) to keep a subprocess off the hook path. (2) **`commit: ""` refused** — sealing in a repo with no commits is now `GateRefusal{no-commit}`; M1 permitted the empty string, but a seal pointing at no commit can't be found in history later. G4 amended and re-confirmed. (3) Three new diagnostic codes (`ledger-line-malformed`, `ledger-entry-invalid`, `ledger-unknown-run`) have **no KC rule mapping yet** — carried forward as a required input to check-engine's G4, or they ship as dead weight.
- **Next:** build gate-ledger — T1 event schema + T2 GitAnchor (parallel), then ledger → seal state → operations → end-to-end on a real git repo.

### 2026-07-20 — run-model built: 8 tasks, 76 tests, three LLD amendments
- **Did:** Phase 7 for `run-model`, all waves. `@keel-dev/core` now loads a repo into a typed, frozen `RepoModel`: manifest, runs, artifacts + frontmatter, requirement/NFR/mandate/assumption rows, HLD feature list, tasks-with-waves, and line-numbered diagnostics. Stack is real: TypeScript 7.0 / vitest 4.1 / Biome 2.5 / zod 4.4 on Node 25.3 (versions verified against the registry — the ones I first wrote from memory did not exist).
- **Decisions / gotchas:** Three LLD amendments, all forced by the locked constraint "v1 templates are the parsing contract" — (1) tasks are headings + bullets, not a table, and `Section` needed `bullets`/`text`; (2) `status: set` is a real v1 value; (3) **`stack.md` (G3), `review-checklist.md` (G6) and `conventions.md` were missing from the recognised artifact set — the model was blind to two of the six gates.** G4 and G5 both re-confirmed. Bugs caught by tests: a frontmatter block parses as a *setext heading* (phantom section); feature names split at internal hyphens (`gate-ledger` → `gate`). Latency measured honestly (fixture 28 ms, this repo 232 ms, budget 300 ms) — the cold-process hook-path number stays **UNKNOWN** until the bundled `cli` package exists, carried as an open risk for G6.
- **Verified:** the loader reads this repo's own `specs/keel-v2` with **0 diagnostics** — 14 requirements, 9 mandates, 7 assumptions all confirmed, 7 features, 8 tasks with correct waves and dependencies.
- **Next:** `/lld gate-ledger`. Note for the check engine: `tasks.md` "Satisfies" cells here contain prose ("foundation for R3, R4"), which KC-11 will rightly flag as dangling IDs — a content fix for later, not a parser bug.

### 2026-07-19 — G3 locked; LLD begins with run-model
- **Did:** Stack locked by Rohan (TS/Node ≥ 20 ESM · npm workspaces · @keel-dev/* scoped, bin `keel` · commander/tsup/zod/remark/vitest/Biome · internal child_process git wrapper · composite Action). Started Phase 4 with the `run-model` feature (foundation — typed RunModel everything else consumes). Side note: a product-flows artifact (UX walkthrough, 10 scenarios) was published on 2026-07-13 for pitching — communication doc only, no gate impact.
- **Decisions / gotchas:** LLD order per HLD feature list: run-model → gate-ledger → check-engine → state-projection → scaffold → adapters → upgrade. G4 is per-feature.
- **Next:** Draft `features/run-model/lld.md`, hold at G4.

### 2026-07-13 — Kickoff → G1 → G2 in one session
- **Did (later same session):** Phase 2 HLD — three critical design questions decided (ledger is sole gate truth; seals verify against the working tree with invalidation derived at read time; rules are code-with-metadata with one severity table). C4 L1–L3 + 2 sequence flows + conceptual data model as D2 SVGs in `diagrams/`. Feature list: run-model, gate-ledger, check-engine, state-projection, scaffold, adapters, upgrade. **G2 signed by Rohan.** Next: `/stack` (G3 confirms tooling details + resolves the npm-name UNKNOWN; language is a locked constraint).

### 2026-07-13 — Kickoff + requirements locked (G1)
- **Did:** Phase 0 kickoff (greenfield · standard path · profile `standard` + testing→production override · renderer d2/installed). Phase 1: wrote `requirements.md` — R1–R14, N1–N7, Literal Mandates M1–M9, assumptions A1–A7 all confirmed. Clarify loop resolved four design-changing questions (scope = alpha+v2.0; docs site out; non-keel repo → exit 0 + notice with `--strict`; M6 state-field exception granted). **G1 signed by Rohan.**
- **Decisions / gotchas:** Upstream plan of record (D1–D6): https://claude.ai/code/artifact/edafc8be-c3a1-4cb8-a355-e84d99ada5db. Stack is a pre-decided constraint (TS/Node ≥ 20) — G3 confirms details only. One open `UNKNOWN`: npm name availability, resolved at G3 per A3.
- **Next:** `/hld` — high-level design for the CLI (components, critical design questions, D2 diagrams into `specs/keel-v2/diagrams/`).
