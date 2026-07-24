---
artifact: conventions
phase: 3
gate: "—"
status: draft
updated: 2026-07-13
---

# Project Codebook — keel-v2

## Tech Stack
- Language / runtime: TypeScript (strict), Node ≥ 20, ESM-only
- Packages: npm workspaces — `@keel-dev/core`, `@keel-dev/cli` (bin `keel`), composite GitHub Action
- Key libraries: commander · gray-matter · unified/remark (+gfm) · zod · yaml · tsup · vitest · Biome
- No datastore, no network, no daemon — all state is files in the git repo

## Project Structure

```
packages/
  core/                     # @keel-dev/core — all logic, no I/O formatting
    src/
      model/                # schema v2 (zod) + RunModel loader (only place that reads artifacts)
      rules/                # KC-01…13, one file each + catalog.ts (THE severity table, M4)
      ledger/               # gates.jsonl append/query + seal verification
      anchor/               # git via child_process (only place that shells out)
      project/              # state projector: STATUS "Now", frontmatter state fields
      scaffold/             # init / run new (copies assets/, never authors)
      migrate/              # v1 → schema v2 upgrade
    test/
      fixtures/<case>/      # golden-fixture repos: input tree + expected findings JSON
  cli/                      # @keel-dev/cli — commander wiring + output formats (human/agent/ci)
  action/                   # composite GitHub Action (action.yml, no JS build)
assets/
  templates/                # the v2 artifact templates keel init installs
  hooks/                    # prepare-commit-msg + Claude Code settings snippets
```

## Conventions
- **Style / format:** Biome defaults, 100-column lines; `npm run check` = biome + typecheck + tests.
- **Naming:** `camelCase` functions, `PascalCase` types, `kebab-case` filenames; rule files named `kc-01-frontmatter.ts` style.
- **Imports:** `node:` prefix for builtins; `import type` for types; core never imports from cli.
- **Errors:** two channels, never confused —
  - *Findings* (rule violations, unsealed gates) are **values**, never exceptions.
  - *Failures* (bad usage, missing git, unreadable file) throw `KeelError { code, message, nextAction }`.
- **Exit codes:** `0` ok · `1` block-severity findings / gate not sealed · `2` usage or environment failure. Hooks depend on 1-vs-2 to distinguish "blocked by design" from "keel is broken."
- **Tests:** vitest; unit tests colocated (`*.test.ts`); engine/ledger behavior proven by golden fixtures (`test/fixtures/<case>/` → run check → compare findings snapshot). Every KC rule has ≥ 1 fixture that trips it and ≥ 1 that passes.

## Key Implementation Patterns

### Rules are pure
- A rule is `(model: RunModel, ledger: LedgerView) => Finding[]`. No filesystem, no git, no clock, no config reads inside a rule. All inputs arrive loaded. This is what makes N1 determinism and fixture testing hold.

### One door per side-effect (mirrors the HLD arrows)
- Artifact reads → `model/loader` only. Git → `anchor` only. Artifact writes (state frontmatter fields only) → `project` only. Ledger writes → `ledger` only. A PR that adds `fs` or `child_process` anywhere else is wrong by construction.

### Ledger is append-only
- A write is: serialize one JSON line → append → fsync. Never rewrite, reorder, or delete lines. Reopen/invalidation are new events or derived state, never edits (N2, M1).

### Derived, never stored
- Gate validity, downstream invalidation, phase, and next-action are computed from (model + ledger + gate order) at read time. If you're about to persist a derived value anywhere but STATUS's `Now` projection, stop.

### Agent-actionable messages
- Every blocking message is one sentence naming the gate/rule + one imperative next action (N6): `G1 not sealed at current content — re-confirm requirements, then run: keel gate pass G1 --run <run>`.

### Timestamps and ordering
- `Date.now` only at ledger-write time (the `ts` field). Findings are sorted stably (rule id, then path, then line) so output diffs are meaningful.

## Do NOT
- Do NOT write artifact content beyond the state frontmatter fields `status`/`updated` — M6's only exception is A5 (`gate pass`/`reopen` via the projector).
- Do NOT mutate or rewrite existing `gates.jsonl` lines — append-only, always (N2).
- Do NOT invent absent values — no default actor, no guessed trailer, no placeholder hash; omit and, where relevant, report `UNKNOWN` (M5, N5, P7).
- Do NOT put a severity anywhere except `rules/catalog.ts` (M4 lives in exactly one table).
- Do NOT let warn findings touch the exit code (M3).
- Do NOT add any network call, telemetry, or analytics — nothing in this run may open a socket (N7).
- Do NOT add a dependency without a driver row in `stack.md` — habit picks reopen G3.
- Do NOT import `@keel-dev/cli` from `core`, or format output inside `core`.
