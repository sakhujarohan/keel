# Diagram renderer gallery — D2 / D2-themed / Mermaid

Every diagram type keel produces, plus common UML types it didn't yet have, rendered three ways via the Kroki MCP so we can pick keel's default on **real visuals**. Content is drawn from the v3 ticketing domain (not generic). Open the SVGs side by side.

**Variants:** `*-d2` = D2 default · `*-d2-themed` = D2 theme 200 + sketch (hand-drawn) · `*-mermaid` = Mermaid.

| Type | In v3? | D2 | D2 themed | Mermaid |
|------|--------|----|-----------|---------|
| Architecture / container | yes | `arch-d2.svg` | `arch-d2-themed.svg` | `arch-mermaid.svg` |
| Sequence (checkout saga) | yes | `seq-d2.svg` | `seq-d2-themed.svg` | `seq-mermaid.svg` |
| ER / data model | yes | `erd-d2.svg` | `erd-d2-themed.svg` | `erd-mermaid.svg` |
| Class (seat-hold) | yes | `class-d2.svg` | `class-d2-themed.svg` | `class-mermaid.svg` |
| State machine (order lifecycle) | no → sample | `state-d2.svg` | `state-d2-themed.svg` | `state-mermaid.svg` |
| Activity (hold→pay→confirm) | no → sample | `activity-d2.svg` | `activity-d2-themed.svg` | `activity-mermaid.svg` |
| Use case (actors × features) | no → sample | `usecase-d2.svg` | `usecase-d2-themed.svg` | `usecase-mermaid.svg` |
| Deployment (infra topology) | no → sample | `deployment-d2.svg` | `deployment-d2-themed.svg` | `deployment-mermaid.svg` |

24 SVGs = 8 types × 3 variants.

## How each renderer handles each type

- **Architecture / Deployment / Use case** — neither D2 nor Mermaid has a *native* type; both model these as graphs. D2's containers/shapes (`person`, `cloud`, `cylinder`, `queue`) and routing make these read best; Mermaid uses subgraphs and looks busier.
- **Sequence** — both native. D2 groups alt-branches as labelled containers; Mermaid has classic `alt` blocks and is the most LLM-familiar.
- **ER** — D2 `sql_table` (PK/FK styled rows) vs Mermaid `erDiagram` (crow's-foot). Both clear; D2 is cleaner, Mermaid renders natively in markdown.
- **Class** — D2 `shape: class` vs Mermaid `classDiagram`. Comparable.
- **State** — Mermaid `stateDiagram-v2` is purpose-built and tidy; D2 models it as a graph (works, slightly more manual).

## Honest renderer notes

- **D2 themed** = one `vars.d2-config` block (`theme-id` + `sketch: true`); must be **multi-line** (commas on one line fail). Sketch mode ≈ the hand-drawn look you wanted from Excalidraw — without needing Excalidraw.
- **Excalidraw** (not here) is out for agent use: Kroki's excalidraw wants full Excalidraw **JSON**, not a text DSL.
- **D2** never renders natively in markdown → the SVG must be committed (keel already does this).
- **Mermaid** renders inline in GitHub/Obsidian with no committed file; best portability, plainer look, most familiar to LLMs.

## Suggested default

**D2 for committed SVGs** (clean by default; `sketch` available for a hand-drawn feel), **Mermaid as the zero-setup fallback** (and natural where native markdown rendering matters — e.g. state machines, quick ER). Drop PlantUML/C4 from the default path.
