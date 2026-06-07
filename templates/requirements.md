<!--
TEMPLATE: Requirements (Phase 1). Copy to specs/<run>/requirements.md and fill in.
Delete these HTML comments as you complete each section.
The gate G1 (Requirements Lock) cannot be crossed until the human confirms this is complete and stable.
-->

# Requirements — <run>

**Status:** DRAFT → (set to LOCKED only after G1 sign-off)
**Run:** <run> · **Profile:** <prototype | standard | production>

---

## Problem (one paragraph)

<!-- Restate the problem in your own words. If it came verbally, this is what you'll confirm at G1. -->

## Functional Requirements

<!--
Write each as a testable statement using EARS notation. Pick the pattern that fits:
  • Ubiquitous:     The system shall <response>.
  • Event-driven:   When <trigger>, the system shall <response>.
  • State-driven:   While <state>, the system shall <response>.
  • Unwanted:       If <condition>, then the system shall <response>.
  • Optional:       Where <feature is present>, the system shall <response>.
Give each a stable ID. These IDs flow into HLD, LLD, tasks, and tests.
-->

| ID | Requirement (EARS) | Acceptance criteria |
|----|--------------------|---------------------|
| R1 | When <trigger>, the system shall <response>. | <how we'd verify it> |
| R2 | If <condition>, then the system shall <response>. | <how we'd verify it> |

## Non-Functional Requirements

<!-- Only those the problem actually implies. Mark anything unstated as UNKNOWN and raise it at G1. -->

| ID | Concern | Requirement | Source |
|----|---------|-------------|--------|
| N1 | Concurrency | <e.g. concurrent requests on the same entity must not corrupt state> | <stated / inferred / UNKNOWN> |
| N2 | Consistency | | |
| N3 | Performance / Scale | | |
| N4 | Availability | | |
| N5 | Security | | |

## Constraints

<!-- Fixed decisions you don't get to make: mandated stack, data formats, external interfaces, deadlines. -->

- <constraint>

## Out of Scope (explicit)

<!--
THE MOST IMPORTANT SECTION for preventing scope-latch. State what you are deliberately NOT building.
Naming the boundary is what stops the design from sprawling.
-->

- <not building X>
- <not handling Y in this version>

## Open Questions

<!-- Every question whose answer would change the design. Resolve all design-changing ones before G1. -->

- [ ] <question> — *needs answer before lock because <reason>*

---

## G1 — Requirements Lock

- [ ] All design-changing open questions resolved (no blocking `UNKNOWN`)
- [ ] Out-of-scope list is explicit
- [ ] Every requirement has an ID and acceptance criteria
- [ ] **Human has confirmed: requirements are complete and stable**

> Do not propose any design until this gate is signed off.
