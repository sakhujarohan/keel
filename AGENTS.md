# Keel — Agentic Development Lifecycle

> **This file is the operating context.** Any agent — Claude Code, Codex, Cursor, Gemini, Aider, or a human — can read this single file and run the full lifecycle with no other context. `CLAUDE.md` and `GEMINI.md` are symlinks to this file so every tool loads the same instructions.

Keel is a **deterministic, gated workflow** for building software with one or more AI agents — from a raw problem statement to shipped, reviewed code. It is designed so the *same steps produce the same quality every run*, whether you have a week or an afternoon.

It is not tied to any language, framework, or domain. The tech stack is **chosen during a run**, as a gated step — never assumed up front.

---

## Prime Directive

**Follow the lifecycle in order. Each phase ends in a GATE. Never proceed past a gate without the human's explicit sign-off.**

The gates exist to stop the single most common and most expensive failure in AI-assisted development: an agent **designing or coding before the problem is locked**, latching onto a partial reading, and producing work that has to be torn down when the real requirements surface.

When in doubt, stop at the gate and ask. A blocked agent costs minutes; a wrong design costs the session.

---

## The Lifecycle at a Glance

| # | Phase | Artifact (from `templates/`) | Gate — human sign-off |
|---|-------|------------------------------|------------------------|
| 0 | **Kickoff** | `specs/<run>/context.md` | — |
| 1 | **Requirements** | `specs/<run>/requirements.md` | **G1 — Requirements Lock** *(no design before this)* |
| 2 | **High-Level Design** | `specs/<run>/hld.md` | **G2 — HLD sign-off** |
| 3 | **Stack Selection** | `specs/<run>/stack.md` + `conventions.md` | **G3 — Stack Lock** |
| 4 | **Low-Level Design** | `specs/<run>/features/<feature>/lld.md` | **G4 — LLD sign-off** (per feature) |
| 5 | **Task Breakdown** | `specs/<run>/features/<feature>/tasks.md` | review |
| 6 | **Build & Test** | code + tests | — |
| 7 | **Harden & Review** | `review-checklist.md`, ADRs in `decisions/` | **G5 — Ship review** |

The full per-phase playbook — inputs, activities, exit criteria — is in **`workflow/lifecycle.md`**. Read it before running a phase. For time-boxed or rapid work, read **`workflow/fast-path.md`**, which compresses the artifacts without removing the gates.

---

## Anti-Patterns This Workflow Exists to Prevent

Name them out loud when you catch one. Each maps to a gate or principle that prevents it.

- **Premature design** — proposing architecture before requirements are locked. *Prevented by G1.*
- **Scope-latch** — anchoring on an early or partial reading of the problem and missing requirements that surface later. *Prevented by the Phase-1 clarify loop and explicit out-of-scope list.*
- **Requirements-drift** — a new requirement appears mid-build and silently invalidates the design. *Handled by looping back to the earliest affected gate, not patching forward.*
- **Gate-skipping** — jumping to code because the problem "looks simple." *Prevented by the Prime Directive.*
- **Context-loss** — a later phase forgetting the rationale of an earlier one. *Prevented by traceability IDs that flow requirement → design → task → test.*
- **Over-engineering** — speculative abstraction for needs that do not exist yet. *Prevented by the smallest-correct-solution principle.*
- **Invented facts** — fabricating a number, constraint, or capability. *If unknown, write `UNKNOWN` and ask. Never guess a fact.*
- **Vibe-coding** — writing code with no spec to trace it to. *Every line of code traces to a task; every task traces to a requirement.*

---

## How to Start a Run

**Claude Code:** run `/kickoff` and follow the prompts. The phase commands are `/kickoff → /requirements → /hld → /stack → /lld → /tasks → /review`. Session commands: `/resume` at the start, `/status` to refresh the dashboard, `/handoff` before you stop.

**Any other agent:** open `workflow/lifecycle.md` and execute Phase 0. Create `specs/<run>/` for this piece of work (`<run>` = a short kebab-case name for the feature or project).

Phase 0 establishes three things and writes them to `specs/<run>/context.md`:
1. **Mode** — new project (greenfield) · feature or change in an existing codebase.
2. **Time budget** — drives whether you use the standard path or the fast path.
3. **Rigor profile** — `prototype`, `standard`, or `production` (see below).

---

## Run State & Continuity

Every run keeps a **`specs/<run>/STATUS.md`** — the *captain's log* — so work survives across sessions and agents:

- **Source of truth = artifact frontmatter.** Each artifact carries a small YAML block (`phase`, `gate`, `status`, `updated`). When a gate passes, its artifact is set to `status: signed-off`.
- **`STATUS.md` has two zones.** `## Now` is a *derived* snapshot (phase, gate line, task rollup, next action) — regenerated, never hand-edited. `## Session log` is append-only, newest on top — one entry per work session.
- **Commands:** `/status` regenerates `Now` from the frontmatter + tasks; `/handoff` (session end) appends a log entry and prints a git-anchored resume packet; `/resume` (session start) re-orients from `STATUS.md` + git and confirms the next step. Agents without these commands do the same by hand.

---

## Rigor Profiles

Production rigor is **modular**, not all-or-nothing. A profile sets a default level for each engineering concern (tests, observability, resilience, security, docs, CI, performance). Pick one at kickoff:

- **`prototype`** — validate an idea fast. Core-path tests, basic logging, minimal ceremony.
- **`standard`** — a real, maintainable service. Unit + integration tests, structured logging, input validation, ADRs.
- **`production`** — ship at scale. Adds contract/e2e tests, metrics + tracing, resilience patterns, threat model, full CI/CD, SLOs.

**Per-concern overrides are expected.** "`standard`, but production-level observability" is a valid, common choice — record it in `context.md`. See `profiles/` for the full axis-by-axis definition.

---

## Operating Principles

These hold in every phase. The full constitution is in **`principles.md`**.

1. **Specs are the source of truth.** Code is the *expression* of the spec. When intent changes, change the spec first, then flow it down.
2. **Traceability end-to-end.** Every requirement has an ID (`R1`, `R2`, …). Designs, tasks, tests, and commits reference the IDs they satisfy.
3. **Tests prove behavior.** Tests are written against acceptance criteria, not against the implementation.
4. **Smallest correct solution.** Solve the locked requirements and nothing more. Add abstraction when a second caller exists, not before.
5. **No invented facts.** Unknowns are marked `UNKNOWN` and raised, never guessed.
6. **Load-bearing decisions are recorded** as ADRs in `decisions/`.
7. **Human owns intent; agent owns execution.** Gates are where intent is confirmed. Between gates, the agent works autonomously.

---

## Multi-Agent Operation

Keel runs with one agent or many. When parallelizing:

- **All agents read this file first**, plus the specific `specs/<run>/` artifact for their task.
- **Split at the task layer** (Phase 5). `tasks.md` is dependency-ordered; tasks with no unmet dependencies can run concurrently (independent "waves"). Two agents must not edit the same file in the same wave.
- **Roles are optional but useful** for larger work: a *designer* agent owns Phases 1–4 (specs and diagrams), *builder* agents own Phase 6 tasks, a *reviewer* agent owns Phase 7. Each role still respects the gates.
- **Context travels in the artifacts, not in chat history.** A builder agent must be able to complete a task from `lld.md` + `tasks.md` alone. If it can't, the design is underspecified — loop back to G4.

---

## File Map

```
AGENTS.md            ← this file: operating context (CLAUDE.md, GEMINI.md → symlinks)
README.md            ← human-facing intro + how to detach into its own repo
principles.md        ← the constitution: principles + named anti-patterns
profiles/            ← rigor profiles (prototype / standard / production) + the axes
workflow/
  lifecycle.md       ← the full 8-phase gated playbook (read before each phase)
  fast-path.md       ← compressed overlay for time-boxed / rapid work
templates/           ← fill-in skeleton for every artifact a phase produces
.claude/commands/    ← Claude Code slash commands that drive each phase
specs/               ← per-run artifacts + STATUS.md (the captain's log), one folder per run
decisions/           ← ADRs accumulate here across runs
```

---

## Agent-Agnostic Setup

`AGENTS.md` is the canonical instruction file (the cross-tool open standard read natively by Codex, Cursor, Copilot, Gemini, Aider, Windsurf, and more). `CLAUDE.md` and `GEMINI.md` are symlinks to it, so Claude Code and Gemini load the identical context. Claude Code additionally gets the `/commands` in `.claude/commands/`; every other agent drives the same flow straight from `workflow/lifecycle.md`. There is no tool-specific logic in the workflow itself — only in how each tool is *invoked*.
