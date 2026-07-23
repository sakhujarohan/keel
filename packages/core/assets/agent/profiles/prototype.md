# Profile: `prototype`

**Intent:** validate an idea or prove a mechanism, fast. Optimized for learning speed, not longevity. Use for spikes, proofs of concept, and disposable experiments.

> Baseline craftsmanship still applies (clear names, no dead code, deliberate errors). `prototype` scales down *hardening*, never *quality*.

| Concern | Level | What that means here |
|---------|-------|----------------------|
| **Testing** | core-path unit | Test the critical logic — the thing the prototype is meant to prove. Edge cases can wait. |
| **Observability** | basic logging | `print`/logger at decision points. No metrics, no tracing. |
| **Resilience** | basic error handling | Handle the obvious failure paths; don't build retry/idempotency machinery. |
| **Security** | input validation | Validate inputs that would crash the happy path. No auth unless the prototype is *about* auth. |
| **Documentation** | README | A few lines: what it is, how to run it. |
| **CI / Automation** | none required | Run tests locally. No pipeline. |
| **Performance** | none | Don't optimize. Note obvious cliffs if you see them. |

**Mandatory regardless:** the core path is tested; the README says how to run it; any known shortcut is noted so it isn't mistaken for finished work.

**Graduating a prototype:** when a prototype is promoted to real work, re-run the lifecycle from Phase 1 at `standard` or `production`. A prototype is evidence, not a foundation — don't build production on top of it without re-deciding the gates.
