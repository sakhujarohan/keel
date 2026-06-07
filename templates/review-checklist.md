---
artifact: review
phase: 7
gate: G5
status: draft        # draft | signed-off
updated: <YYYY-MM-DD>
---

<!--
TEMPLATE: Review Checklist (Phase 7). Copy to specs/<run>/review-checklist.md (or run inline).
Scope it to the chosen rigor profile: a `prototype` need not satisfy `production` rows. Check the rows that
apply at your profile's level (see profiles/). A deliberately skipped row is fine IF it's documented as a
known limitation — an undocumented gap is a defect. Delete these comments.
-->

# Review Checklist — <run>

**Profile:** <prototype | standard | production> (+ overrides) · **Reviewed:** YYYY-MM-DD

---

## Traceability & Validation Ledger

<!-- The acceptance back-check: every requirement → the tasks that built it → the tests that prove it → status. A requirement with no passing test is not done. -->

| Req | Tasks | Tests | Status |
|-----|-------|-------|--------|
| R1 | T1, T3 | <test names> | ✓ pass / ✗ / partial |
| R2 | | | |

Also reconcile the **Performance Targets** table in `requirements.md` — fill its "Achieved" column from the build / load results.

---

## Correctness (all profiles)
- [ ] Every requirement (R-IDs) is satisfied and has a passing test
- [ ] Acceptance criteria pass; a plausible-but-wrong implementation would fail the tests
- [ ] Edge cases and boundaries are handled
- [ ] No `UNKNOWN` or invented fact remains in the shipped behavior

## Testing
- [ ] Core-path tests pass *(prototype+)*
- [ ] Unit + integration tests cover the critical flows *(standard+)*
- [ ] Contract + e2e tests for service boundaries and key journeys *(production)*

## Resilience & Error Handling
- [ ] Inputs validated; errors are deliberate, not incidental *(standard+)*
- [ ] State-mutating retryable operations are idempotent *(standard+)*
- [ ] Timeouts, retries-with-backoff, circuit breakers on downstreams *(production)*
- [ ] Every failure mode has a defined behavior *(production)*

## Observability
- [ ] Logging at decision points *(prototype+)*
- [ ] Structured logs with correlation IDs *(standard+)*
- [ ] Metrics + distributed tracing; debuggable from telemetry *(production)*

## Security
- [ ] Inputs sanitized; no obvious injection vectors *(prototype+)*
- [ ] Authn/authz where the domain requires it; secrets not in source *(standard+)*
- [ ] Dependency scan clean; lightweight threat model done *(production)*

## Performance
- [ ] Hot paths and obvious bottlenecks understood *(standard+)*
- [ ] Load/stress tested against defined SLOs *(production)*

## Documentation & Decisions
- [ ] README: how to run, approach, known limitations *(all)*
- [ ] Load-bearing decisions captured as ADRs *(standard+)*
- [ ] API docs + operational runbook *(production)*
- [ ] Known limitations are **documented**, not hidden

---

## G5 — Ship Review
- [ ] Checklist passes at the profile's level
- [ ] Known limitations documented (with how you'd close them)
- [ ] A stranger could run and understand it from the README
- [ ] **Human has confirmed it's ready to ship / submit**
