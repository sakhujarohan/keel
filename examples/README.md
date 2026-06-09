# examples/

Worked examples produced by running keel end-to-end. Each folder is a complete run — read it to see what the artifacts actually look like.

## ticket-booking

A high-scale **event-ticketing platform** (Java/Spring · Postgres · Redis · Kafka · Elasticsearch) taken through the design spine (Phases 0–5) at the `production` rigor profile — keel's canonical complex example, the kind of problem a hard system-design round would hand you.

Worth a look for:
- **`requirements.md`** — 12 EARS requirements, 9 NFRs, performance targets, explicit assumptions and out-of-scope.
- **`hld.md`** — a readable narrative plus **rendered D2 diagrams** (system context, containers, two flow sequences, ER data model) with their source in `<details>`, four critical design questions, and a feature list.
- **`stack.md` + `conventions.md`** — choices traced to NFR drivers, and the per-project codebook (patterns + a "Do NOT" list).
- **`decisions/`** — two full ADRs (no-oversell strategy; idempotent checkout saga) with options, pros/cons, and pitfalls.
- **`features/*/lld.md`** — an LLD for every feature, with table-by-table schemas and D2 class diagrams; `seat-hold` carries readable Goal/Done-when tasks.
- **`diagrams/`** — the committed D2 SVGs, plus **`diagrams/samples/`**, a 24-SVG renderer gallery (D2 / D2-sketch / Mermaid across 8 diagram types) used to pick keel's default renderer.

Note: in a real run, ADRs live in `decisions/` at the **project root**; here they're co-located under the example so it stays self-contained.
