# Rigor Profiles

Production rigor is **modular**. A profile sets a default level for each engineering concern; you pick a profile at kickoff and override individual concerns as needed. This is how Keel lets you build a throwaway prototype and a production service with the *same lifecycle* but the *right amount* of ceremony.

Choose one profile in `context.md`. Record any per-concern overrides there too.

---

## The concerns (axes)

Every profile assigns a level to each of these. Levels escalate: each higher level includes everything below it.

| Concern | What it covers |
|---------|----------------|
| **Testing** | Unit, integration, contract, end-to-end. Depth of behavioral coverage. |
| **Observability** | Logging, metrics, tracing. How visible the running system is. |
| **Resilience** | Error handling, input validation, retries, idempotency, timeouts, circuit breakers. How the system behaves under failure. |
| **Security** | Input sanitization, authn/authz, secrets management, dependency scanning, threat modeling. |
| **Documentation** | README, ADRs, API docs, runbooks. |
| **CI / Automation** | Lint, build, test automation, deployment pipeline. |
| **Performance** | Awareness, basic profiling, load testing, defined SLOs. |

---

## The three profiles at a glance

| Concern | `prototype` | `standard` | `production` |
|---------|-------------|------------|--------------|
| Testing | core-path unit | unit + integration | + contract + e2e |
| Observability | basic logging | structured logging | + metrics + tracing |
| Resilience | basic error handling | + validation + idempotency where needed | + retries + timeouts + circuit breakers |
| Security | input validation | + authn/authz + secrets mgmt | + dependency scan + threat model |
| Documentation | README | + ADRs | + API docs + runbook |
| CI / Automation | none required | lint + test | + build + deploy pipeline |
| Performance | none | basic awareness | + load test + SLOs |

The per-axis detail for each level is in the individual profile files (`prototype.md`, `standard.md`, `production.md`).

---

## Overrides

A profile is a starting point, not a straitjacket. Common, valid combinations:

- *"`standard`, but production-level observability"* — a service you need to watch closely in prod but isn't yet at scale.
- *"`prototype`, but standard-level security"* — a quick build that still touches real credentials.
- *"`production`, minus the deploy pipeline"* — shipping into an existing platform that owns CD.

Write the override explicitly in `context.md`, e.g.:

```
Profile: standard
Overrides: observability → production (need metrics + tracing from day one)
           performance  → none (internal tool, no scale concern)
```

Baseline craftsmanship — clear names, no dead code, deliberate error handling — is **never** subject to override. Profiles scale *hardening*, not *quality*.
