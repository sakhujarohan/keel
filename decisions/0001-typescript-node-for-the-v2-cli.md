# ADR 0001 — TypeScript on Node for the v2 CLI

- **Status:** Accepted
- **Date:** 2026-07-13
- **Run:** keel-v2

## Problem & forces

Keel v2 moves gate enforcement out of prompts into a CLI (`keel check`, `keel gate`). The implementation language decides three things at once: how the tool is distributed (the ten-minute-to-first-block adoption target), how fast the hook path starts (a `PreToolUse` hook runs `keel check --require` before phase skills — the latency budget is p95 < 500 ms), and who can contribute (a solo-maintainer OSS project lives or dies on contributor familiarity). The tool's actual work is parsing markdown/YAML and shelling out to git — not compute.

## Options considered

### Option A — Go
- **How it works:** single static binary per platform; distribution via GitHub releases / Homebrew / `go install`.
- **Pros:** best cold-start latency; no runtime dependency; trivially portable binaries.
- **Cons:** no `npx`-style zero-install trial (the adoption path every target user already has); markdown/frontmatter ecosystem is thinner than JS's; release engineering (multi-platform builds, checksums) is real ongoing work for a solo maintainer.

### Option B — Rust
- **How it works:** as Go, with cargo/binaries.
- **Pros:** performance headroom beyond any need this tool has; strong correctness culture.
- **Cons:** slowest iteration speed of the three; smallest contributor pool for a dev-workflow tool; same distribution burden as Go. Performance is not a binding constraint here — parsing a handful of markdown files is not compute-bound.

### Option C — TypeScript on Node ≥ 20 ← chosen
- **How it works:** npm-distributed workspaces (`@keel-dev/core`, `@keel-dev/cli`); users run `npx @keel-dev/cli` or install globally for the `keel` bin; single-file ESM bundles via tsup keep startup lean.
- **Pros:** `npx` is the zero-install trial path (directly serves the < 10-minute adoption metric); the best markdown/YAML/frontmatter ecosystem of the three (remark, gray-matter, zod); largest contributor pool; every target user already has Node.
- **Cons:** Node startup overhead eats into the 500 ms hook budget (mitigated by bundling; measured, not assumed, in Phase 7); requires Node ≥ 20 present; ESM-only cuts off legacy embedders.

## Decision

TypeScript on Node ≥ 20, ESM-only, npm workspaces. Distribution beats raw startup speed: the tool's growth path is `npx keel init` in an existing agent workflow, and the workload is I/O + parsing where the JS ecosystem is strongest.

## Pitfalls & limitations of the chosen option

The hook path carries Node's startup cost on every intercepted tool call. If measurement in Phase 7 shows the p95 < 500 ms budget failing on real repos after bundling, the escape hatch is a compiled fast-path (`keel check --require` only) — that would reopen this ADR, scoped to the hot command, not the whole tool.

## Consequences

- **Positive:** zero-install trial; one `npm publish` release process; schema and rules are plain TypeScript any contributor can read.
- **Negative / trade-off:** runtime dependency on Node ≥ 20; startup budget must be actively defended (bundling, lazy imports).
- **Follow-ups:** measure hook-path latency in Phase 7 against the fixture repo; revisit only on measured failure.
