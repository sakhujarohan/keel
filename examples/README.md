# examples/

Worked examples produced by running keel end-to-end. Each folder is a complete run — read it to see what the artifacts actually look like.

## ticket-booking

A concurrent ticket-booking service (Go + Postgres) taken through the design spine (Phases 0–5) plus an ADR — keel's validation dry run. Worth a look for: the captain's-log `STATUS.md`, EARS requirements with an explicit out-of-scope list, a C4 high-level design, a stack decision traced to NFRs, a per-feature LLD, dependency-ordered tasks, and `decisions/0001` (preventing double-booking with a unique constraint).

Notes:
- It predates the project-codebook step, so it has no `conventions.md`.
- In a real run, ADRs live in `decisions/` at the **project root**; here they're co-located under the example so it stays self-contained.
