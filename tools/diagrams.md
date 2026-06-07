# Diagrams — optional Kroki toolchain

Keel's diagrams default to **inline Mermaid** in the HLD/LLD docs — zero dependencies, renders on GitHub. That's the fallback and it always works.

For richer, *validated* diagrams (C4 architecture, sequence, ERD/DBML) rendered to committed SVGs, keel recommends the **Kroki MCP + `diagram-generation` skill** from the MCP Skill Suite. It's **optional**: set it up once and agents use it; skip it and inline Mermaid still carries the run.

> Source: **https://github.com/sakhujarohan/mcp-skill-suite** (MIT) — Kroki MCP server + `diagram-generation` skill.

## Setup (once per project, ~2 min)

1. **Install the server** (Python 3.10+): clone the suite, then in a venv `pip install -e packages/mcp-servers/kroki`. (See the suite's `packages/mcp-servers/kroki/docs/installation.md`.)
2. **Enable the MCP:** copy `tools/mcp.json.example` to your project root as `.mcp.json` and adjust `command` (use `kroki-mcp` if on PATH, or the full venv path) / `KROKI_ENDPOINT`.
3. **Install the skill:** copy the suite's `packages/skills/diagram-generation/SKILL.md` → `.claude/skills/diagram-generation.md`.
4. Restart your agent. Ask *"what diagram tools do you have?"* — expect the 7 Kroki tools.

**Privacy:** the public endpoint (`https://kroki.io`) receives your diagram source. For anything sensitive, self-host — `docker run -d -p 8000:8000 yuzutech/kroki` — and set `KROKI_ENDPOINT=http://localhost:8000`.

## The 7 tools

`generate_diagram` · `validate_diagram` · `list_templates` · `get_template` · `generate_from_template` · `list_diagram_types` · `get_server_info`. SVG is the default; the server validates before generating and returns line-numbered errors with fixes.

## Keel diagram conventions

| Where | Diagram | Kroki type |
|-------|---------|-----------|
| HLD — system architecture (C4) | Context / Container / Component | `c4plantuml` |
| HLD — key flows | sequence | `plantuml` |
| HLD — conceptual data model | ER | `erd` |
| LLD — class design | class | `plantuml` (or `mermaid`) |
| LLD — concrete data model | schema | `dbml` (or `erd`) |

**The pattern** (keeps the doc the source of truth, per `principles.md`):
- Generate with `save_path` into **`specs/<run>/diagrams/<name>.svg`** and commit the SVG.
- In the artifact, embed **both** the rendered image (`![alt](diagrams/<name>.svg)`) **and** its source in a `<details>` block — so the diagram is reviewable and regenerable from the doc alone.
- **Template-first:** `list_templates` before writing source from scratch. **Validate-first:** fix and retry on validation errors before generating.

When the toolchain isn't set up, write inline Mermaid in the same spots (the HLD/LLD templates show this) — no SVG, no `<details>`, still gated and reviewable.
