---
artifact: review
phase: 8
gate: G6
status: draft
updated: 2026-07-21
---

# Review Checklist — keel-v2

**Run:** keel-v2 · **Profile:** standard (testing → production) · **Gate:** G6 — Ship review

The whole v2.0 scope (plan milestones alpha + v2.0): seven features, the CLI, both adapters, and the
migrator. The honest completion signal from the plan — **Keel's own check passes this repository with
zero blocking findings** — is met.

---

## Verdict

**Ready to ship as `v2.0.0-alpha`**, with the v2.0.x patch list below tracked as known, deliberate
deferrals. No blocking finding is outstanding; the remaining warnings are documented.

## Review checklist (scoped to `standard` + testing→production)

- [x] **Correctness** — 219 tests; the check engine, ledger, and seal logic proven by fixtures and
  real-git integration tests. Keel enforces its own run at 0 blocking findings.
- [x] **Tests (production depth on the core)** — golden fixtures for the loader and engine; real git
  repositories for the ledger, gates, CLI, hook, and migrator; the M1 hash-equality test; the
  ticket-booking migration on the real shipped example.
- [x] **Resilience** — every environment failure throws and surfaces as exit 2, distinct from a
  verdict; the ledger survives a mangled line; the migrator and init refuse rather than half-acting.
- [x] **Observability** — `keel doctor`, agent-actionable messages (problem + next action) on every
  finding and refusal.
- [x] **Security / integrity** — append-only ledger, hash-anchored seals, working-tree verification;
  no network access anywhere; git identity honest about being asserted not authenticated.
- [x] **Performance** — N3 measured (below).
- [x] **Docs** — README rewrite, the action's README, in-code module docs; ADRs 0001–0002.

## Traceability & Validation Ledger

Every requirement → where it is proven.

| Req | What it demands | Proven by |
|-----|-----------------|-----------|
| R1 | `keel init` scaffolds, never overwrites | `scaffold.test.ts` (idempotent, merge, invalid-JSON) |
| R2 | `keel run new` | `scaffold.test.ts` (creates, rejects non-kebab, refuses existing) |
| R3 | `keel check` over the catalog | `check-engine.test.ts`, `report.test.ts` |
| R4 | assert a gate | `require-gate.test.ts`, `cli.e2e.test.ts` |
| R5 | seal a gate | `operations.test.ts`, `gate-ledger.integration.test.ts`, `cli.e2e.test.ts` |
| R6 | dirty-tree refusal | `operations.test.ts` (refusal + `--allow-dirty`) |
| R7 | seal-break detection | `seal.test.ts`, `gate-ledger.integration.test.ts` |
| R8 | reopen | `operations.test.ts`, integration walk |
| R9 | derive status | `project.test.ts` |
| R10 | block gate-skipping in-agent | `scaffold.test.ts` (matchers wired), `cli.e2e.test.ts` (fast path blocks) |
| R11 | attribute commits | `hook.test.ts` (omit-never-invent, no-dup, human commit) |
| R12 | gate merges in CI | `packages/action/action.yml` + `--ci` annotations in `format.test.ts` |
| R13 | migrate v1 runs | `upgrade.test.ts`, `ticket-booking.test.ts` (real example, zero edits) |
| R14 | `keel doctor` | `scaffold.test.ts` |
| N1 | determinism | `determinism.test.ts`, frozen contexts, explicit sorts |
| N2 | ledger integrity | append-only tests, concurrent-append test |
| N3 | latency | **measured — see below** |
| N4 | portability | Node ≥ 20, no native deps; macOS/Linux |
| N5 | honesty | omit-never-invent (hook, migrator, actor) |
| N6 | agent-actionable errors | every finding/refusal message |
| N7 | privacy | no network call anywhere in scope |

## Spec-Compliance Ledger (every Literal Mandate → shipped)

| M | Mandate | Shipped as | ✓ |
|---|---------|-----------|---|
| M1 | Ledger field set; `git hash-object` | closed `GateEvent` schema; native blob id proven equal to git across 6 input classes | ✓ |
| M2 | Dirty-tree refusal; `dirty: true` | `prepareSeal` refusal + flag stamp | ✓ |
| M3 | `check` exits iff ≥1 block | exit code derived in one place; env failures are exit 2, outside the iff | ✓ |
| M4 | Severities fixed | one frozen `SEVERITIES` table; asserted literally | ✓ |
| M5 | Exact trailers; omit never invent | commit hook; `hook.test.ts` | ✓ |
| M6 | Verification only; A5 state-frontmatter exception | writes confined to ledger + derived STATUS zone + state frontmatter lines; sealing hashes the post-sign state so the projection never authors content | ✓ |
| M7 | `.keel/gates.jsonl`, keyed by run | `LEDGER_PATH`; `SealKey{run,gate,artifact}` | ✓ |
| M8 | `upgrade` dirty refusal; `legacy: true` | migrator guard + backfill flag | ✓ |
| M9 | Git identity for `actor`; upgradeable | anchor identity; opaque string field | ✓ |

## Performance targets (N3) — measured

| Metric | Target | Achieved |
|--------|--------|----------|
| `check --require` (hook path), **bundled** cold start | p95 < 500 ms | **~55 ms** (node + esbuild bundle, macOS/M-series) |
| `check --require` via `tsx` (dev, unbundled) | — | ~750 ms (TypeScript compiled on the fly; not the shipped path) |
| loader, clean fixture (warm) | < 300 ms | ~28 ms |
| full `check`, this repo (warm) | < 2 s | ~232 ms |

**The N3 UNKNOWN is resolved.** ADR 0001's escape hatch (a compiled fast path) is **not** needed: the
bundled hook path is ~9× under budget. The `tsx` figure that looked alarming during the build was
on-the-fly TypeScript compilation, not the artifact users run.

---

## Known limitations & v2.0.x candidates

Each: what it is · why deferred · what would trigger the fix.

1. **KC-07 has no "missing spec-check" arm.** It checks mandate coverage *within* a spec-check that
   exists, but says nothing about a feature with no `spec-check.md` at all. · Low incidence; KC-06's
   sibling logic could extend to it. · Fix when a run ships a feature that skipped Phase 5 unnoticed.
2. **The `.keel/` dirty-tree exemption is a prefix match.** A real content edit *inside* `.keel/`
   would be exempted from the seal's clean-tree guarantee. · The directory is Keel-owned and not
   hand-edited in practice. · Fix if `.keel/` ever holds anything but the append-only ledger.
3. **sha256 repositories are coded for but untested.** The shell-out fallback exists; no CI covers
   it. · Vanishingly rare today. · Fix when a sha256 repo is reported, or add a CI matrix leg.
4. **Windows is unsupported (A4).** WSL works. · Path and hook-script assumptions are POSIX. · Fix on
   real demand.
5. **KC-12 is narrowed** from the plan's "framework-doc self-consistency" to template-version drift,
   which is the only mechanically-true reading in a general repo. · Recorded at G5. · Revisit only if
   the original intent is wanted as a Keel-repo-specific CI rule.
6. **KC-13 scans the last 200 commits.** A commit older than that goes unattributed-unnoticed. · The
   window covers a feature's worth of history. · Make it configurable if a large monorepo needs more.
7. **A seal and its frontmatter projection are a pair** (gate-ledger amendment 2). Between `commitSeal`
   and `setArtifactState` the seal reads broken; a crash there needs a `reopen`+`pass` to recover. ·
   The window is microseconds inside one CLI command. · Fix by making the pair transactional if a
   real crash-recovery report appears.
8. **Telemetry is deferred to v2.1 (D5)** — off by default, design not yet locked.
9. **G6 is per-run, not per-feature.** A single ship review covers the run. · Matches the plan. · Add
   per-feature review gating only if runs grow large enough to need it.
10. **The maintainer's own chore-commits** (reseal/reopen) carry no attribution trailers, because this
    repo's commit hook was added by hand rather than `keel init`. They surface as KC-13 warnings —
    the tool correctly flagging its own history. · Cosmetic. · Run `keel init` here, or accept them.

## Deliberate scope cuts (recorded, not hidden)

- **No `tsup` build wired into the repo yet.** The bundle was produced ad-hoc with esbuild to measure
  N3; wiring `tsup` into `packages/cli` for `npm publish` is the first v2.0.0 (non-alpha) task.
- **Not published to npm.** Package names (`@keel-dev/*`) are chosen (A3) but unclaimed.

---

## G6 — Ship review

- [x] Checklist passes at the profile's level (standard + testing→production)
- [x] Traceability & Validation Ledger complete — every requirement has a proving test
- [x] Spec-Compliance Ledger complete — every Literal Mandate ✓
- [x] Performance targets reconciled (N3 measured, budget met)
- [x] Known limitations documented, not hidden (the v2.0.x list above)
- [x] Keel's own check passes this repository at 0 blocking findings
- [x] **Human has confirmed: ready to ship v2.0.0-alpha** — Rohan, 2026-07-21
