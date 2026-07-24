<!--
TEMPLATE: Architecture Decision Record. Copy to decisions/NNNN-short-title.md (NNNN = next number, zero-padded).
One ADR per load-bearing decision: anything expensive to reverse, or that a future reader would otherwise have to
reverse-engineer. Write it so a newcomer understands the problem, the real options, and why — readably (no ID-soup).
Delete these comments.
-->

# ADR NNNN — <short title>

- **Status:** Proposed | Accepted | Superseded by ADR-XXXX
- **Date:** YYYY-MM-DD
- **Run:** <run> (or "cross-cutting")

## Problem & forces

<!-- What decision is being made and why it's hard. The requirement/NFR driving it, the constraints, and the tension
between forces (e.g. correctness vs. throughput). A reader should grasp the problem without opening other docs. -->

## Options considered

<!-- Two or more REAL options, each with honest pros and cons — not one-liners. -->

### Option A — <name>
- **How it works:** <one or two sentences>
- **Pros:** <…>
- **Cons:** <…>

### Option B — <name>   ← chosen
- **How it works:** <…>
- **Pros:** <…>
- **Cons:** <…>

<!-- Optional at-a-glance comparison for contested calls:
| Criterion | Option A | Option B (chosen) |
|-----------|----------|-------------------|
| <correctness> | … | … |
| <throughput>  | … | … |
| <complexity>  | … | … |
-->

## Decision

<!-- What we chose, in plain language, and the one or two reasons that tipped it. -->

## Pitfalls & limitations of the chosen option

<!-- Be honest about what this choice makes harder or where it breaks down — the thing a future engineer will hit.
e.g. "a single hot partition still caps one mega-event's throughput; mitigated by the waiting room, revisit if a
single event exceeds X." -->

## Consequences

- **Positive:** <what becomes easy / safe>
- **Negative / trade-off:** <what we now live with>
- **Follow-ups:** <anything to revisit, or a condition that would reopen this decision>
