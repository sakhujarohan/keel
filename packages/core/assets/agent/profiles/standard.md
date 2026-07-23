# Profile: `standard`

**Intent:** a real, maintainable service that a team could own. The sensible default for most work. Solid without the full weight of large-scale production.

| Concern | Level | What that means here |
|---------|-------|----------------------|
| **Testing** | unit + integration | Unit tests for logic; integration tests for the wiring (DB, HTTP, queues) against real or realistic dependencies. Tests trace to acceptance criteria. |
| **Observability** | structured logging | Structured logs (key/value or JSON) with correlation IDs on the critical paths. Metrics optional (override up if needed). |
| **Resilience** | validation + idempotency where needed | Full input validation; deliberate error responses; idempotency for any operation that mutates state and can be retried; sensible timeouts. |
| **Security** | authn/authz + secrets mgmt | Authentication and authorization where the domain requires it; secrets from config/vault, never hard-coded; no obvious injection vectors. |
| **Documentation** | README + ADRs | README (run, approach, limitations) and ADRs for load-bearing decisions. |
| **CI / Automation** | lint + test | Lint and tests run automatically (locally via a script or in CI). Green build is the bar for "done." |
| **Performance** | basic awareness | Know the hot paths and the obvious bottlenecks; no premature optimization, no formal load testing. |

**Mandatory regardless:** integration tests cover the critical flows; state-mutating retryable operations are idempotent; secrets are not in source; load-bearing decisions have ADRs.

**Why this is the default:** `standard` fits most real work. Reviewers and teammates reward correctness, tests, and clear, *documented* decisions far more than unrequested production machinery — so `standard` makes that the bar without over-building.
