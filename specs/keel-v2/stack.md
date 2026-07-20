---
artifact: stack
phase: 3
gate: G3
status: signed-off
updated: 2026-07-19
---

# Stack Selection — keel-v2

**Status:** LOCKED (G3 signed by Rohan, 2026-07-19) · **Drivers:** see NFRs in `requirements.md`, shape in `hld.md`

Language/runtime arrived as a **locked constraint** from the plan of record (§4, formalized here as ADR 0001) — G3's real decisions are the tooling around it, the package naming (resolving A3's `UNKNOWN`), and the codebook.

---

## Decisions

| Choice | Candidates considered | Decision | Driver (NFR / constraint) | ADR |
|--------|-----------------------|----------|---------------------------|-----|
| Language / runtime | Go, Rust, **TypeScript on Node ≥ 20** | TypeScript, Node ≥ 20, ESM-only | Constraint from plan of record: npx zero-install distribution, md/YAML ecosystem, contributor pool (N4) | [0001](../../decisions/0001-typescript-node-for-the-v2-cli.md) |
| Repo layout / package manager | pnpm workspaces, yarn, single package, **npm workspaces** | npm workspaces monorepo: `packages/core`, `packages/cli`, `packages/action` | N4 + P4 — zero extra toolchain for contributors (npm ships with Node); 3 packages don't earn pnpm's complexity. Revisit if phantom-dependency bugs appear. | — |
| Package naming | unscoped `keel` (taken), **scoped packages** | Scoped: preferred org `@keel-dev` (fallbacks `@keeldev`, `@keel-cli`), claimed at first publish; bin command stays **`keel`** | A3 + D1. **Verified 2026-07-13:** npm `keel` is an active third-party product (v0.468.0, keel.so backend platform). Org availability is `UNKNOWN` (anonymous probes blocked) — resolved at publish, decision structure unaffected. | — |
| CLI framework | yargs, citty, clipanion, **commander** | commander | N3 hook-path latency (small module graph, fast startup) + ubiquity — every contributor has read commander code | — |
| Markdown + frontmatter parsing | regex/hand-rolled, marked, **gray-matter + unified/remark** | gray-matter (frontmatter) + remark-parse + remark-gfm (tables → AST) | Loader correctness — KC rules read requirement/mandate/task tables; a real GFM AST beats regex the first time a cell contains a pipe | — |
| Schema validation | ajv, valibot, **zod** | zod | Typed `RunModel` from one schema definition (KC-01); contributor familiarity | — |
| YAML (`keel.yaml`) | js-yaml, **yaml** | `yaml` (eemeli) for the manifest; gray-matter keeps its built-in engine for frontmatter | Manifest needs comment-preserving round-trips for `keel upgrade` (M8) | — |
| Git access | simple-git, isomorphic-git, **thin internal wrapper over `node:child_process`** | Internal Git anchor: `execFile` of `git hash-object · status --porcelain · rev-parse · config` | N3 (no wrapper overhead on the hot path) + N4 (zero deps, no native bindings) + HLD rule "only the anchor touches git." Refines the plan's simple-git note — same driver (shell out, never bind libgit2), thinner. | — |
| Build / bundling | tsc-only, rollup, **tsup (esbuild)** | tsup → single-file ESM bundle per package, `keel` bin in `@keel-dev/cli` | N3 — p95 < 500 ms on the hook path means minimizing module resolution at startup; single-file bundles cut require cost | — |
| Test runner | node:test, jest, **vitest** | vitest; golden-fixture repos under `packages/core/test/fixtures/` | Profile override testing → production: fixture/snapshot ergonomics and TS-native execution make "fixture repo in, findings out" suites cheap to write and fast to run | — |
| Lint / format | eslint + prettier, **Biome** | Biome (lint + format, one config) | Solo-maintainer OSS: one fast tool, near-zero config. Accepted risk: smaller rule ecosystem than typescript-eslint | — |
| GitHub Action | JS action (bundled), **composite action** | Composite action running `npx @keel-dev/cli check --ci`; annotations via `::error file=…` workflow commands | P4 — no second build artifact to version and bundle; the CLI already owns `--ci` output (R12) | — |
| Data store | — | **None.** All state is files in the git repo (artifacts, `keel.yaml`, `.keel/gates.jsonl`) per HLD context diagram | N1/N2 — repo state is the whole point; a store would be invented state | — |
| Messaging / async | — | **None.** Single-process CLI; no daemon | P4 | — |
| Gate-truth model | (design decision surfaced by HLD Q1/Q2) | Ledger is sole gate truth; working-tree seal verification; derived invalidation | N2, M1, R7 | [0002](../../decisions/0002-ledger-as-gate-truth-working-tree-seals.md) |

## Stack Conventions

The project codebook is **`specs/keel-v2/conventions.md`** — structure, naming, error/exit-code contract, the purity rules that mirror the HLD dependency arrows, and the Do-NOT list. Phase 7 builds against it.

## Known Trade-offs & Risks

- **Bin-name collision:** the `keel` command may collide for users who also globally install npm's `keel` (keel.so) or keel.sh's binary. Accepted per D1 — `npx @keel-dev/cli` is always unambiguous; documented in the README rather than renamed.
- **npm org availability `UNKNOWN`:** `@keel-dev` cannot be verified without an authenticated claim attempt. Resolution step at first publish; fallbacks are pre-agreed so no gate reopens.
- **ESM-only:** no CJS consumers of `@keel-dev/core` are supported. Fine for a CLI; a constraint if the core is ever embedded in older toolchains.
- **Biome vs. eslint:** fewer TS-specific lint rules; if a needed rule class is missing, the switch back to typescript-eslint is config-only, not code.
- **Node floor ≥ 20 only** — Bun/Deno compatibility is not claimed or tested (N4 scope is macOS/Linux + Node).
- **Startup-latency target is unproven until measured:** p95 < 500 ms is asserted as a budget, not a benchmark — first measured in Phase 7 against the fixture repo (no invented numbers).

---

## G3 — Stack Lock

- [x] Every major choice is traced to a driver (no habit/hype picks)
- [x] Load-bearing choices have ADRs (0001 runtime · 0002 gate-truth model)
- [x] Trade-offs and risks are stated (unknowns marked, not guessed)
- [x] **Human has locked the stack** — Rohan, 2026-07-19. Changing it later means returning to this gate
