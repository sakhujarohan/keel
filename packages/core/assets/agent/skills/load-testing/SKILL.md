---
name: load-testing
description: Use when load- or stress-testing a service, verifying behavior under concurrency, or chaos-testing failure modes — especially at the `production` rigor profile (Phase 6/7).
---

# Load & Chaos Testing

Validate a service under realistic and adverse conditions. Pairs with the `production` profile (`profiles/production.md`).

## When

- Verifying performance against the **Performance Targets** in `requirements.md` (p50/p99 latency, throughput, error rate).
- Proving correctness under **concurrency** — the race the LLD's concurrency notes claim to handle.
- **Chaos**: behavior when a dependency is slow, down, or returning errors.

## Approach

1. **Load test** — drive realistic traffic (e.g. Locust): ramp users, hold, measure. Record p50/p99 latency, throughput, and error rate against the targets.
2. **Concurrency / race test** — fire N concurrent requests at the contended resource; assert the invariant holds (e.g. exactly one winner). This is the test that *proves* the design's concurrency claim, not just its speed.
3. **Chaos** — inject failure on a dependency (timeout, kill, 5xx); assert graceful degradation, that retries/timeouts/circuit-breakers behave, and that nothing is corrupted.

## Metrics to watch

| Metric | What it tells you |
|--------|-------------------|
| p50 / p99 latency | typical and tail responsiveness |
| throughput (req/s) | capacity |
| error rate under load | where it starts to break |
| invariant under concurrency | correctness, not just speed |

## Output

Record results in the run's **Traceability & Validation Ledger** and fill the **Performance Targets** "Achieved" column in `requirements.md`. A target with no measured "Achieved" is not validated.
