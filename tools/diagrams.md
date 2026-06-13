# Diagrams — Kroki toolchain (D2 default)

Keel renders diagrams as committed SVGs via the **Kroki MCP**. The **renderer is a configurable choice**, set once per run in `context.md` (Phase 0) and applied from the HLD onward. Default is **D2**.

> Source: **https://github.com/sakhujarohan/mcp-skill-suite** (MIT) — Kroki MCP server + `diagram-generation` skill.

## Renderer choice (configurable)

Set `Diagram renderer:` in `specs/<run>/context.md`. Options, in keel's preferred order:

1. **`d2`** *(default)* — cleanest modern look and best auto-layout across every diagram type; committed as SVG (D2 doesn't render natively in markdown).
2. **`mermaid`** — renders **natively** in GitHub/Obsidian with zero setup and is the most LLM-familiar; plainer styling. Best when native inline rendering matters or the Kroki MCP isn't available. Also the **fallback** when no toolchain is set up (write inline Mermaid in the doc).
3. **`d2-sketch`** — D2 with a hand-drawn theme (opt-in; theme id is tunable — see *Theming*). Nice for informal/whiteboard-feel diagrams.

A run uses one renderer for consistency. Excalidraw is intentionally **not** supported: Kroki's excalidraw renderer needs full Excalidraw JSON, not a text DSL, so an agent can't author it inline.

## Setup — Phase 0 action (agent runs this automatically at kickoff)

The agent performs this setup as part of `/kickoff` (Phase 0, activity 3) — it is **not** optional manual setup. The agent bootstraps the renderer before writing `context.md`; the run's `Renderer status:` field records the outcome.

1. **Install the server** (Python 3.10+): clone the suite (`https://github.com/sakhujarohan/mcp-skill-suite`), then in a venv `pip install -e packages/mcp-servers/kroki`. (See the suite's `packages/mcp-servers/kroki/docs/installation.md`.)
2. **Enable the MCP:** copy `tools/mcp.json.example` to your project root as `.mcp.json` and adjust `command` (use `kroki-mcp` if on PATH, or the full venv path) / `KROKI_ENDPOINT`. Restart the agent.
3. **(Optional) install the skill:** copy the suite's `packages/skills/diagram-generation/SKILL.md` → `.claude/skills/diagram-generation.md`.
4. Confirm with `get_server_info` (expect `server_reachable: true`). Set `Renderer status: installed` in `context.md`.

**If the install fails:** surface the error and the Mermaid fallback option to the human. Wait for explicit acceptance — never adopt the fallback silently. Record `Renderer status: fallback-mermaid (accepted by <human> on <date>)` in `context.md`.

**Privacy:** the public endpoint (`https://kroki.io`) receives your diagram source. For anything sensitive, self-host — `docker run -d -p 8000:8000 yuzutech/kroki` — and set `KROKI_ENDPOINT=http://localhost:8000`.

## Diagram type → renderer syntax

| Where | Diagram | D2 (default) | Mermaid (alt) |
|-------|---------|--------------|---------------|
| HLD — system context / containers | architecture | graph + shapes (`person`, `cloud`, `cylinder`, `queue`), nested containers | `graph TB` + subgraphs |
| HLD — key flows | sequence | `shape: sequence_diagram` (alt-branches as nested containers) | `sequenceDiagram` + `alt` |
| HLD — data model | ER | `shape: sql_table` with `{constraint: primary_key|foreign_key}` | `erDiagram` |
| HLD/LLD — state | state machine | graph; circle start/end (`shape: circle`) | `stateDiagram-v2` *(purpose-built — a good Mermaid-per-type exception)* |
| LLD — class design | class | `shape: class` | `classDiagram` |
| LLD — concrete schema | schema | `shape: sql_table` | `erDiagram` |
| (optional) activity / use-case / deployment | flow / actors / topology | graph + shapes/containers | `flowchart` + subgraphs |

Worked, validated examples of all of these live in `examples/ticket-booking/diagrams/samples/` (D2, D2-sketch, Mermaid side by side).

## The pattern (keeps the doc the source of truth, per `principles.md`)

- Generate with `save_path` into **`specs/<run>/diagrams/<name>.svg`** and commit the SVG.
- In the artifact, embed **both** the rendered image (`![alt](diagrams/<name>.svg)`) **and** its source in a `<details>` block — so the diagram is reviewable and regenerable from the doc alone.
- **Validate-first:** the server validates before generating and returns line-numbered errors with fixes — fix and retry rather than committing a broken diagram.

If no toolchain is set up, fall back to **inline Mermaid** in the same spots (no SVG, no `<details>`) — still gated and reviewable.

## Theming (D2)

`d2-sketch` (and any theme) is set with a **multi-line** `vars` block at the top of the source — a single-line block with commas fails to compile:

```d2
vars: {
  d2-config: {
    theme-id: 200
    sketch: true
  }
}
```

Theme ids are swappable (Kroki/D2 ships several); pick one and record it alongside `Diagram renderer:` in `context.md` if you deviate from the default.

## The 7 tools

`generate_diagram` · `validate_diagram` · `list_templates` · `get_template` · `generate_from_template` · `list_diagram_types` · `get_server_info`. SVG is the default output.
