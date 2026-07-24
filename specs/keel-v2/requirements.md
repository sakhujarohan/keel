---
artifact: requirements
phase: 1
gate: G1
status: signed-off
updated: 2026-07-13
---

# Requirements — keel-v2

**Status:** LOCKED (G1 signed by Rohan, 2026-07-13)
**Run:** keel-v2 · **Profile:** standard (testing → production)

---

## Problem (one paragraph)

Keel v1 is a gated SDLC methodology enforced only by prompts: nothing mechanically stops an agent from designing past an unsigned gate, and a gate sign-off is a chat sentence that evaporates with the session. This run builds the **Keel v2 enforcement layer** — a TypeScript CLI that owns the run state machine: it validates artifacts against a schema, checks traceability (rules KC-01…KC-13), records gate sign-offs as git-anchored ledger entries, detects post-sign-off tampering ("seal breaks"), and exposes everything as exit codes that agent hooks and CI can block on. The CLI **verifies; it never authors** — the model keeps writing every artifact. Upstream spec: the signed-off plan of record (G1 2026-07-13, decisions D1–D6).

## Functional Requirements

| ID | Requirement (EARS) | Acceptance criteria |
|----|--------------------|---------------------|
| R1 | **Scaffold a repo** — When `keel init` runs inside a git repository, the system shall write `keel.yaml`, install the v2 templates, and wire the configured adapters (git hook, Claude Code hooks) without overwriting existing files. | Re-running is idempotent; running outside a git repo fails with a clear error; existing files are skipped and reported. |
| R2 | **Start a run** — When `keel run new <name>` runs, the system shall create `specs/<name>/` with `context.md` and `STATUS.md` from the installed templates. | Name validated as kebab-case; existing run name → error, nothing written. |
| R3 | **Check a repo** — When `keel check` runs, the system shall evaluate rules KC-01…KC-13 against every run (or the run given by `--run`) and exit non-zero if and only if at least one block-severity rule fails. | Warn findings never affect the exit code; each finding reports rule ID, artifact path, line where determinable, and a one-line fix hint. |
| R4 | **Assert a gate** — When `keel check --require G<n> --run <r>` runs, the system shall exit 0 only if gate G<n> is sealed for that run at the artifact's current content. | Unsealed or seal-broken gate → exit 1 with a message naming the gate and the next action (written to be actionable by an agent). |
| R5 | **Seal a gate** — When `keel gate pass G<n> --run <r>` runs on a clean tree, the system shall append a ledger entry (run, gate, event, artifact, artifact_hash, actor, commit, ts) to `.keel/gates.jsonl` and update the artifact's frontmatter `status` to `signed-off`. | Entry is one valid JSON line; `artifact_hash` equals `git hash-object` of the artifact; `actor` comes from git identity; the command prints what is being sealed before writing. |
| R6 | **Dirty-tree refusal** — If the working tree is dirty when `keel gate pass` runs, then the system shall refuse — unless `--allow-dirty` is passed, in which case the ledger entry records `dirty: true`. | Refusal names the dirty paths; the flagged entry is visibly marked in `keel status` output. |
| R7 | **Seal-break detection** — If a sealed artifact's content no longer hashes to its ledger entry, then `keel check` shall report a seal break as a block finding and treat every downstream gate of that run as invalid. | Editing a sealed `requirements.md` makes `check` fail, naming G1 as broken and listing the downstream gates now invalid. |
| R8 | **Reopen a gate** — When `keel gate reopen G<n> --run <r>` runs, the system shall append a `reopen` event and return the artifact to `gate-pending`, leaving prior ledger history intact. | Ledger is append-only — reopening adds an event, never rewrites one. |
| R9 | **Derive status** — When `keel status --run <r>` runs, the system shall regenerate the `## Now` block of that run's `STATUS.md` from frontmatter + ledger + tasks, leaving `## Session log` untouched. | Output matches the template's `Now` shape; hand-edits to `Now` are overwritten; the session log is byte-identical before and after. |
| R10 | **Block gate-skipping in-agent** — Where the Claude Code adapter is installed, when a phase skill is invoked whose upstream gate is unsealed, the system shall block the invocation with a message naming the gate and next action. | Invoking `/hld` with G1 unsealed is blocked; sealing G1 unblocks it with no other change. |
| R11 | **Attribute agent work** — When a commit is made in a repo with the Keel git hook installed, the system shall append attribution trailers (`Keel-Run`, `Keel-Task`, `Agent-Tool`, `Agent-Model`, `Agent-Session`, `Co-Authored-By`) populated from `KEEL_AGENT_*` environment variables; values the environment does not supply are omitted. | A commit made from a Claude Code session carries model + session trailers; a human commit with no `KEEL_AGENT_*` env gets no invented values. |
| R12 | **Gate merges in CI** — Where the GitHub Action is configured, the system shall run `keel check --ci` and fail the workflow on any block finding, emitting file/line annotations for each finding. | A PR with a seal break cannot merge when the check is required; annotations point at the offending artifact lines. |
| R13 | **Migrate v1 runs** — When `keel upgrade` runs on a v1-layout repo with a clean tree, the system shall write `keel.yaml`, bump artifact frontmatter to schema v2, and backfill ledger entries from `status: signed-off` frontmatter marked `legacy: true`. | The `examples/ticket-booking` run migrates with zero manual edits; dirty tree → refusal; re-running is a no-op. |
| R14 | **Diagnose the environment** — When `keel doctor` runs, the system shall report environment health (git present, tree state, hook wiring, adapter config, renderer reachability) without modifying anything. | Exit 0 with all-clear or a list of findings; no file is written. |

## Non-Functional Requirements

| ID | Concern | Requirement | Source |
|----|---------|-------------|--------|
| N1 | Determinism | `keel check` is a pure function of repo state: same tree + ledger → same findings and exit code; no network access in any check or gate path. | stated (plan §1, §6) |
| N2 | Integrity | The ledger is append-only; no command mutates or deletes an existing entry; tampering is detectable via git history of `.keel/gates.jsonl`. | stated (plan §5) |
| N3 | Latency | `check --require` is fast enough to sit in a pre-tool hook without degrading the agent loop. | inferred — target below |
| N4 | Portability | macOS + Linux, Node ≥ 20; no native/binary dependencies (git via shell-out). | stated (plan §4) |
| N5 | Honesty | Absent facts are omitted, never fabricated — attribution trailers, actor fields, check hints (P7). | stated (plan §5, D6) |
| N6 | Agent-actionable errors | Every blocking failure names the rule or gate and the single next action, phrased so an agent recovers without human help. | stated (plan §7) |
| N7 | Privacy | No telemetry, analytics, or network calls of any kind in this run's scope (telemetry is v2.1, off by default per D5). | stated (D5) |

## Performance Targets

| Metric | Target | Achieved |
|--------|--------|----------|
| `keel check --require` (hook path), warm repo | p95 < 500 ms | <filled at review> |
| `keel check` full catalog, repo with ≤ 20 runs | p95 < 2 s | |
| `keel init` → first mechanically blocked gate-skip (success metric §3 of plan) | < 10 min, measured once at review | |

## Constraints

- **Stack is pre-decided upstream:** TypeScript on Node ≥ 20, npm-distributed monorepo (`@keel/core`, `@keel/cli`, adapters) — recorded in the plan of record §4. G3 confirms details (package naming, tooling), not the language choice.
- **Decisions D1–D6 bind this run:** name stays Keel (D1); repo-level `.keel/gates.jsonl` (D2); git identity for `actor` (D3); strict clean-tree with `--allow-dirty` escape (D4); no telemetry (D5); trailer-based attribution (D6).
- **v1 artifact formats are the parsing contract:** the templates in this repo's `templates/` define what schema v2 must accept (as a superset).
- **Verification-only boundary:** the CLI never authors spec or code content (see A5 for the single state-field exception under discussion).

## Assumptions

| ID | Assumption | Status |
|----|------------|--------|
| A1 | **Run scope = plan milestones v2.0-alpha + v2.0** (core, check catalog, ledger, both adapters, upgrade). v2.1/v2.2 items are out of scope. | confirmed (2026-07-13) |
| A2 | The docs site listed under milestone v2.0 is **not** part of this run — in-repo README-level docs are; the site is a separate content effort. | confirmed (2026-07-13) |
| A3 | npm package naming (the `keel` name is likely taken on npm — `UNKNOWN`, verified at G3) is resolved with a scoped name (e.g. `@keel-dev/…`) without reopening D1. | confirmed (2026-07-13) |
| A4 | Windows is unsupported in v2.0 (WSL works); macOS + Linux only. | confirmed (2026-07-13) |
| A5 | **The one exception to verification-only:** `keel gate pass`/`reopen` may write artifact *state* frontmatter fields (`status`, `updated`) — mechanical state, not content. Everything else in an artifact is agent-authored. | confirmed (2026-07-13) |
| A6 | In a repo with no `keel.yaml`, `keel check` exits 0 with a "not a keel repo" notice (so the GitHub Action is safe to add org-wide); `--strict` makes it an error. | confirmed (2026-07-13) |
| A7 | The Claude Code adapter targets the hooks API as documented today (`PreToolUse` with a Skill matcher); if the API shifts, the adapter tracks it without reopening these requirements. | confirmed (2026-07-13) |

## Literal Mandates

| ID | Mandate (verbatim or close-paraphrase) | Source |
|----|----------------------------------------|--------|
| M1 | Ledger entries are JSON Lines with exactly the fields `run, gate, event, artifact, artifact_hash, actor, commit, ts` plus optional `dirty`, `legacy`; `artifact_hash` is computed as `git hash-object` of the signed content. | plan §5 |
| M2 | `keel gate pass` MUST refuse on a dirty tree; `--allow-dirty` MUST stamp `dirty: true` into the ledger entry. | plan §11 D4 |
| M3 | `keel check` exits non-zero **iff** ≥ 1 block-severity finding; warn findings MUST NOT affect the exit code. | plan §6 |
| M4 | Rule severities are fixed: KC-01…KC-09 = block; KC-10…KC-13 = warn. | plan §6 table |
| M5 | Attribution trailers are exactly `Keel-Run`, `Keel-Task`, `Agent-Tool`, `Agent-Model`, `Agent-Session`, `Co-Authored-By`; a value the adapter cannot determine is **omitted, never invented**. | plan §5, D6 |
| M6 | The CLI never authors spec or code content — verification only. Sole exception (A5, confirmed): `gate pass`/`reopen` may write artifact *state* frontmatter fields (`status`, `updated`). | plan §1 + A5 |
| M7 | The ledger lives at repo level: `.keel/gates.jsonl`, keyed by run. | plan §11 D2 |
| M8 | `keel upgrade` refuses on a dirty tree; backfilled entries MUST carry `legacy: true`. | plan §10 |
| M9 | Gate sign-off identity in v2 is the git identity; the `actor` field must be upgradeable to a verified identity without a ledger format change. | plan §11 D3 |

## Out of Scope (explicit)

- **v2.1 scope:** brownfield `keel survey` and the survey template; telemetry implementation, events file, and `telemetry report`.
- **v2.2 scope:** the published benchmark; template/profile registry.
- **v3 scope:** GitHub App, verified `keel[bot]` identities, policy engine, hosted anything.
- The docs *site* (per A2); web UI; non-engineer experience.
- Windows support (per A4).
- Adapters beyond Claude Code hooks + GitHub Action — other agents use the documented `keel check` convention in `AGENTS.md`.
- Any change to the v1 methodology itself: no new phases, gates, or template semantics beyond schema v2 frontmatter.

## Open Questions

- [x] Q1 — Is this run's scope alpha + v2.0, or alpha only? → **resolved into A1**
- [x] Q2 — Docs site in or out? → **resolved into A2**
- [x] Q3 — Behavior of `keel check` on a non-keel repo? → **resolved into A6**
- [x] Q4 — May the CLI write state frontmatter (the M6 tension)? → **resolved into A5**

---

## G1 — Requirements Lock

- [x] Clarify loop completed — four design-changing questions batched and resolved with Rohan on 2026-07-13 (→ A1, A2, A5, A6)
- [x] All assumptions are `confirmed` — no assumption remains `proposed` (A1–A7 confirmed 2026-07-13)
- [x] Literal Mandates table is populated (or explicitly noted as "None")
- [x] All design-changing open questions resolved (one non-blocking `UNKNOWN` remains: npm name availability, resolved at G3 per A3)
- [x] Out-of-scope list is explicit
- [x] Every requirement has an ID and acceptance criteria
- [x] **Human has confirmed: requirements are complete and stable** — Rohan, 2026-07-13

> Do not propose any design until this gate is signed off.
