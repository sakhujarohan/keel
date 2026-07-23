# Profile: `production`

**Intent:** ship and operate at scale. Everything in `standard`, plus the hardening that real production traffic and on-call ownership demand.

| Concern | Level | What that means here |
|---------|-------|----------------------|
| **Testing** | + contract + e2e | Adds consumer/provider contract tests for service boundaries and end-to-end tests for critical user journeys, on top of unit + integration. |
| **Observability** | + metrics + tracing | Structured logs **and** metrics (RED/USE-style) **and** distributed tracing. The system is debuggable from telemetry alone. |
| **Resilience** | + retries + timeouts + circuit breakers | Retries with backoff, timeouts everywhere, circuit breakers / bulkheads on downstreams, graceful degradation, and a defined behavior for every failure mode. |
| **Security** | + dependency scan + threat model | Adds dependency/vulnerability scanning and a lightweight threat model (what an attacker would target and how it's mitigated), on top of authn/authz + secrets. |
| **Documentation** | + API docs + runbook | Adds published API docs (e.g. OpenAPI) and an operational runbook (how to deploy, roll back, and respond to common alerts). |
| **CI / Automation** | + build + deploy pipeline | Full pipeline: lint, test, build artifact, and deploy (with rollback). No manual deploys. |
| **Performance** | + load test + SLOs | Load/stress testing against defined SLOs (latency, throughput, error budget) — see `skills/load-testing/`; capacity understood before launch. |

**Mandatory regardless:** every failure mode has a defined behavior; the system is observable from telemetry; there is a runbook; SLOs are defined and tested against; deploys are automated and reversible.

**Cost note:** `production` is heavy by design. Don't reach for it reflexively — reach for it when real traffic, real money, or on-call ownership is on the line. For everything else, start at `standard` and override the specific concerns that matter (see `profiles/README.md`).
