---
artifact: conventions
phase: 3
gate: "—"
status: draft
updated: <YYYY-MM-DD>
---

<!--
TEMPLATE: Project Codebook (produced at Stack Lock, Phase 3; evolves during build). Copy to specs/<run>/conventions.md.
This is the per-project operating manual the build phase (Phase 6) follows — keep it tight and LLM-readable.
The stack DECISION lives in stack.md; this is HOW we build in that stack. Delete this comment in the real file.
-->

# Project Codebook — <run>

## Tech Stack
<!-- The locked choices from stack.md, at a glance. -->
- Language / runtime: <...>
- Framework: <...>
- Data store: <...>
- Key libraries: <...>

## Project Structure
<!-- The directory layout and what each part owns. -->

```
<tree>
```

## Conventions
- **Style / format:** <linter / formatter + line length>
- **Naming:** <functions · types · files>
- **Imports:** <ordering / grouping>
- **Errors:** <how errors are returned / raised / wrapped>
- **Tests:** <framework · location · naming · how to run>

## Key Implementation Patterns
<!-- The few patterns specific to THIS project that an agent MUST follow (how concurrency, idempotency, auth, money, etc. are handled). One heading + rule each. -->

### <Pattern name>
- <the rule, stated so an agent can apply it directly>

## Do NOT
<!-- Project-specific prohibitions — concrete, not generic advice. -->

- <e.g. don't bypass the repository layer for DB access>
- <e.g. don't use floating point for money — integer minor units only>
