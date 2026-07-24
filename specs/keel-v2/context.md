---
artifact: context
phase: 0
gate: "—"
status: set
updated: 2026-07-13
---

# Run Context — keel-v2

- **Mode:** new project (greenfield) — the `keel` CLI is a new TypeScript codebase; it lives in this repo but shares no code with the v1 markdown framework. (v1 template/doc updates are downstream consequences, not the subject of this run.)
- **Time budget:** ample → standard path (plan of record budgets ~6 weeks to v2.0-alpha; no external deadline)
- **Rigor profile:** standard (see `profiles/`)
- **Overrides:** testing → production (contract-level: golden-fixture suites for the check engine and gate ledger — a trust-positioned enforcement tool cannot ship with `standard` test depth on its core)
- **Diagram renderer:** d2 (default)
- **Renderer status:** installed (Kroki MCP reachable at https://kroki.io, confirmed 2026-07-13)

**Problem (one line):** Build the Keel v2 enforcement layer — a TypeScript `keel` CLI (artifact schema, gate state machine + git-anchored ledger, `keel check` rules KC-01…13, agent/CI adapters) — so the v1 methodology's gates become mechanically enforced instead of prompt-enforced, per the signed-off plan of record (G1 2026-07-13, decisions D1–D6).

**Upstream input:** Plan of record artifact — https://claude.ai/code/artifact/edafc8be-c3a1-4cb8-a355-e84d99ada5db (product definition, architecture, rule catalog, decisions D1–D6). Phase 1 requirements are seeded from it.
