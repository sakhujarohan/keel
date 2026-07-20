---
artifact: tasks
phase: 6
gate: "—"
status: draft
updated: 2026-07-19
---

# Tasks — run-model

**Run:** keel-v2 · **LLD:** `./lld.md`

Status: `[ ]` todo · `[~]` in progress · `[x]` done (its check passes)

This is the run's first code feature, so Wave 1 carries the one-time monorepo bootstrap. All paths are repo-root-relative; the loader lands in `packages/core/src/model/`. Test-first per the profile (testing → production): each task's "Done when" is a test that exists and passes.

## Wave 1 — no dependencies

### T1 — Monorepo bootstrap
- **Goal:** Stand up the workspace so every later task drops into a green build: root `package.json` (npm workspaces), base `tsconfig`, Biome config, vitest config, and an empty `@keel-dev/core` package with the `npm run check` script (biome + typecheck + tests).
- **Done when:** fresh clone → `npm install && npm run check` passes with zero source files beyond the package stub.
- **Files:** `package.json`, `tsconfig.base.json`, `biome.json`, `vitest.config.ts`, `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/src/index.ts` · **Depends on:** — · **Satisfies:** N4 (foundation)
- `[x]` — Node 25.3 / npm 11; TypeScript 7.0, vitest 4.1, Biome 2.5, zod 4.4 (versions verified against the registry, not assumed)

## Wave 2 — depends on Wave 1

### T2 — Types and the ID grammar
- **Goal:** The entire public surface of the LLD as compiling TypeScript — every interface from the Interfaces/Contracts block verbatim — plus the exported ID regexes (`R/N/M/A/T`, kebab names) that KC-11 will reuse.
- **Done when:** `ids.test.ts` proves the grammar (accepted: `R1`, `T12`, `seat-hold`; rejected: `R01x`, `Waitlist`, `r1`, empty) and the package typechecks with all LLD types exported from `model/index.ts`.
- **Files:** `packages/core/src/model/types.ts`, `packages/core/src/model/ids.ts`, `packages/core/src/model/ids.test.ts`, `packages/core/src/model/index.ts` · **Depends on:** T1 · **Satisfies:** foundation for R3, R4; KC-11 input
- `[x]` — 9 tests; added `model/errors.ts` (KeelError) alongside, as the loader's throw-channel is part of this type surface

## Wave 3 — depends on T2 (parallelizable: three tasks, disjoint files)

### T3 — Frontmatter parsing
- **Goal:** gray-matter + zod → `Frontmatter`, implementing the LLD's frontmatter contract exactly: field enums, `updated` format, `schema_version` absent → 1, extra keys ignored, and every zod issue mapped to one line-numbered `frontmatter-invalid` diagnostic (missing block → `frontmatter-missing`).
- **Done when:** `frontmatter.test.ts` covers the LLD error-model rows: valid v1 file (no `schema_version`) → `schemaVersion: 1`; valid v2; missing block; bad enum; bad date — each yielding the exact diagnostic code, never a throw.
- **Files:** `packages/core/src/model/frontmatter.ts`, `packages/core/src/model/frontmatter.test.ts` · **Depends on:** T2 · **Satisfies:** R3, R13 groundwork; KC-01 input
- `[x]` — 8 tests. Used the `yaml` package as gray-matter's engine so `updated: 2026-07-13` stays a string (js-yaml would return a Date)

### T4 — Manifest parsing
- **Goal:** `keel.yaml` → `Manifest | null` with the A6 distinction the spec-check called out: absent file → `null` + zero diagnostics; present-but-malformed (YAML error, zod failure, unknown keys) → `null` + `manifest-invalid`.
- **Done when:** `manifest.test.ts` proves all three states (absent / valid / malformed) and that unknown keys are rejected, not tolerated.
- **Files:** `packages/core/src/model/manifest.ts`, `packages/core/src/model/manifest.test.ts` · **Depends on:** T2 · **Satisfies:** A6; R1, R13 groundwork
- `[x]` — 7 tests; all three states proven, unknown keys rejected via `z.strictObject`

### T5 — Markdown section & table reader
- **Goal:** remark-parse + remark-gfm → the LLD's `Section[]`/`MdTable[]` shapes: H2/H3 headings with line numbers, each section owning its GFM tables (header cells + rows with line numbers). Pure bytes-in, structure-out — no interpretation of content yet.
- **Done when:** `sections.test.ts` parses a fixture doc with nested headings, two tables under one section, a pipe-inside-backticks cell, and no tables — line numbers verified against the fixture.
- **Files:** `packages/core/src/model/sections.ts`, `packages/core/src/model/sections.test.ts` · **Depends on:** T2 · **Satisfies:** parsing substrate for KC-03…08
- `[x]` — 7 tests. Bug found and fixed: a frontmatter block reads as a *setext H2* in markdown, producing a phantom section; the block is now blanked line-for-line so line numbers stay true

## Wave 4 — depends on T5 (and T2)

### T6 — Table-to-row extractors
- **Goal:** The LLD's table-extraction contracts, one extractor per anchor heading: requirements (R/N), Literal Mandates with the explicit-`None` flag, assumptions with `proposed`/`confirmed` parsing, the HLD feature list, the tasks table (wave/depends/files/done), and the `STATUS.md` split at `## Session log`. Every skip emits its diagnostic (`section-missing`, `table-missing`, `column-missing`, `row-malformed`, `id-malformed`, `id-duplicate`) — nothing dropped silently.
- **Done when:** `extract.test.ts` runs each extractor against good + broken fixtures and asserts both the rows and the exact diagnostic codes/lines; a requirements table with one malformed row still yields the other rows.
- **Files:** `packages/core/src/model/extract.ts`, `packages/core/src/model/extract.test.ts` · **Depends on:** T2, T5 · **Satisfies:** R3, R9
- `[x]` — 16 tests. **Triggered the G4 loop-back (amendment 1):** the LLD specified a tasks *table*; the real format is headings + labelled bullets. Also fixed: feature names were being cut at their internal hyphen (`gate-ledger` → `gate`)

## Wave 5 — depends on everything above

### T7 — Discovery and assembly: `loadRunModel`
- **Goal:** The single entry point: walk `specsDir` per the discovery/filename rules, build `RunEntry`/`FeatureEntry` (HLD list ∪ `features/*`, `declaredInHld` flagged), apply the two-channel error model (`KeelError` ENV throws only for unreadable root/files), sort everything per the determinism contract, deep-freeze in dev.
- **Done when:** `load.test.ts` proves: a two-run fixture loads with runs/features/diagnostics in contract order; `runFilter` narrows; unreadable file throws `ENV_UNREADABLE`; non-artifact files (diagrams, decisions) are never parsed.
- **Files:** `packages/core/src/model/load.ts`, `packages/core/src/model/load.test.ts` · **Depends on:** T3, T4, T5, T6 · **Satisfies:** R3, R4, R9, R13, N1
- `[x]` — 14 tests, including the unreadable-file case (chmod 000 → `ENV_UNREADABLE`, nothing half-loaded) and a frozen-model check

## Wave 6 — depends on T7

### T8 — Golden fixtures, determinism, and the latency budget
- **Goal:** The feature's production-grade proof: fixture repos under `packages/core/test/fixtures/` (clean keel repo · no-manifest · malformed-manifest · broken-frontmatter · missing-tables · duplicate-ids · v1-era run), each snapshot-tested end-to-end (`RepoModel` → stable JSON). Plus the N1 determinism test (two loads → byte-identical serialization) and the first honest N3 measurement (loader time on the clean fixture, recorded — budget < 300 ms).
- **Done when:** all fixture snapshots pass; determinism test passes; the measured load time is written into this file's log line below (a number, not a guess).
- **Files:** `packages/core/test/fixtures/**`, `packages/core/test/golden.test.ts`, `packages/core/test/determinism.test.ts` · **Depends on:** T7 · **Satisfies:** N1, N3
- `[x]` — 7 fixture repos, snapshots committed; determinism proven (identical serialisation across loads). **Triggered amendments 2 and 3:** `status: set` is a real v1 value, and `stack.md` (G3) / `review-checklist.md` (G6) / `conventions.md` were missing from the recognised set entirely — the model was blind to two gates.

**Measured latency (N3), Node 25.3 / M-series macOS — medians of 5 after warm-up:**

| Target | Median | Budget | Verdict |
|--------|--------|--------|---------|
| clean fixture (10 artifacts) | **28 ms** | < 300 ms | ✓ comfortable |
| this repository (1 diagram-heavy run, 74 KB) | **232 ms** | < 300 ms | ✓ but thin headroom |
| cold process, unbundled (`tsx`) | ~1 s import + 126–524 ms load | — | **UNKNOWN for production** |

The cold figure is inflated by on-the-fly TypeScript transpilation and is *not* the production number — the shipped CLI is a tsup bundle. The real hook-path cost (Node boot + bundled import + load, against the p95 < 500 ms target in `requirements.md`) **cannot be measured until the `cli` package exists** and is carried forward as an open risk for the Phase 8 review; it is the exact risk ADR 0001 flagged.

---

## Breakdown checklist
- [x] Every task's **Goal** and **Done when** read clearly on their own (no ID-decoding needed)
- [x] Dependencies form no cycles; no two tasks in a wave touch the same file (Wave 3's three tasks are file-disjoint)
- [x] Each task is small enough that its "Done when" is a single observable check
