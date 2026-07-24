---
description: Start a Keel run — set mode, time budget, and rigor profile
argument-hint: [run-name or one-line problem]
---

You are starting a new Keel run. Read `AGENTS.md` and `workflow/lifecycle.md` (Phase 0) first.

Input: $ARGUMENTS

Do Phase 0 — Kickoff:
1. Agree a short kebab-case `<run>` name and create `specs/<run>/`.
2. Determine **mode** (new project / feature in an existing codebase), **time budget**, and **rigor profile** (`prototype` / `standard` / `production`, see `profiles/`). If the budget is tight, say so — you'll follow `workflow/fast-path.md` for the rest of the run.
3. **Bootstrap the diagram renderer.** Read `tools/diagrams.md` and run the Kroki MCP setup: install the server, write `.mcp.json`, confirm with `get_server_info`. If `server_reachable: true`, record `Renderer status: installed` in `context.md` and proceed with D2 (default) or the human's preferred renderer. If the install fails, surface the error and the Mermaid fallback option to the human — wait for explicit acceptance before setting `Renderer status: fallback-mermaid (accepted by <human> on <date>)`. Never adopt the fallback silently.
4. Write `specs/<run>/context.md`: mode, budget, profile, any per-concern overrides, diagram renderer, renderer status, and a one-line framing of the problem.
5. Create `specs/<run>/STATUS.md` from `templates/status.md`.

Do **not** start analyzing or solving the problem. Confirm mode, profile, and renderer status with the human, then stop. Next: `/requirements`.
