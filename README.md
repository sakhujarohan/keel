# Keel

**A deterministic, gated workflow for building software with AI agents — from problem statement to shipped, reviewed code.**

_v1.0.0 · MIT-licensed · works with any AI coding agent — Claude Code, Codex, Cursor, Gemini, and more._

Keel is a project seed. Copy it (or start a run inside it), and you get a repeatable lifecycle that takes you through requirements, high-level design, stack selection, low-level design, task breakdown, build/test, and review — with a human sign-off gate at every transition. It is stack-agnostic: the language and framework are chosen *during* a run, as a deliberate step, never assumed.

It exists to make AI-assisted development **produce the same quality every time** — whether you have a week or an afternoon.

---

## Why it's built this way

The expensive failure in AI-assisted development is the agent that designs or codes before the problem is locked, anchors on a partial reading, and produces work that has to be torn down. Keel's gates make that failure structurally impossible: **no design before requirements are locked, no code before the design is signed off.**

It borrows the proven ideas from the field — versioned markdown specs as the source of truth, EARS-style acceptance criteria, an always-on "constitution," explicit quality gates, dependency-ordered tasks, ADRs — and adds three things most frameworks lack:

1. **HLD and LLD as distinct, separately-gated layers** (with UML/Mermaid diagrams), instead of one merged "design" doc.
2. **An explicit Stack-Lock gate** between high-level design and implementation, so the tech choice is a recorded decision, not an assumption.
3. **Modular rigor profiles** — toggle production concerns (observability, resilience, security depth) per project instead of all-or-nothing.

---

## How to use it

**With Claude Code:** open this folder and run the phase commands in order:

```
/kickoff  →  /requirements  →  /hld  →  /stack  →  /lld  →  /tasks  →  /review
```

**With any other agent (Codex, Cursor, Gemini, Aider, …):** open `AGENTS.md`, then follow `workflow/lifecycle.md` phase by phase. The workflow has no tool-specific logic.

Each run lives in its own folder under `specs/<run>/`. Artifacts accumulate there; decisions accumulate in `decisions/`.

---

## What's in here

| Path | What it is |
|------|------------|
| `AGENTS.md` | The operating context. Read first. (`CLAUDE.md`, `GEMINI.md` symlink to it.) |
| `principles.md` | The constitution — always-on principles and named anti-patterns. |
| `workflow/lifecycle.md` | The full 8-phase gated playbook. |
| `workflow/fast-path.md` | Compressed overlay for time-boxed / rapid work. |
| `profiles/` | Rigor profiles and the concern-by-concern axes. |
| `templates/` | A fill-in skeleton for every artifact. |
| `.claude/commands/` | Claude Code slash commands for each phase. |
| `tools/` | Optional toolchain setup — diagrams via the Kroki MCP. |
| `skills/` | Optional reusable capability modules (`SKILL.md` pattern). |
| `specs/` | Per-run artifacts (one folder per run). |
| `decisions/` | Architecture Decision Records. |
| `examples/` | Worked example runs — read these to see real artifacts. |

---

## Using Keel as a project seed

Keel is self-contained — nothing in it depends on a parent directory. To use it for a new piece of work, copy the folder (or clone the repo) and start a run with `/kickoff` (or, for non-Claude agents, follow `workflow/lifecycle.md`). Artifacts for that run land in `specs/<run>/`; decisions accumulate in `decisions/`.

## License

[MIT](LICENSE) © 2026 Rohan Sakhuja
