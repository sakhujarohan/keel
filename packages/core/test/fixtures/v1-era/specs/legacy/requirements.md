---
artifact: requirements
phase: 1
gate: G1
status: signed-off
updated: 2026-07-20
---

# Requirements — demo

## Functional Requirements

| ID | Requirement (EARS) | Acceptance criteria |
|----|--------------------|---------------------|
| R1 | When asked, the system shall answer. | it answers |
| R2 | The system shall persist answers. | survives restart |

## Non-Functional Requirements

| ID | Concern | Requirement | Source |
|----|---------|-------------|--------|
| N1 | Determinism | same input yields same output | stated |

## Literal Mandates

| ID | Mandate | Source |
|----|---------|--------|
| M1 | Responses MUST use HTTP 201 on create | spec 3.2 |

## Assumptions

| ID | Assumption | Status |
|----|------------|--------|
| A1 | single region for v1 | confirmed (2026-07-20) |

## Out of Scope

- everything else
