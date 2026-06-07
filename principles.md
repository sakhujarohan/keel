# The Keel Constitution

The always-on rules. They bind every phase, every agent, and every run. The lifecycle (`workflow/lifecycle.md`) tells you *what to do when*; this file tells you *what is always true*.

If a principle here ever conflicts with a request, surface the conflict — do not silently violate the principle.

---

## Principles

### P1 — Specs are the source of truth
Code is the expression of a spec, not the other way round. When intent changes, the spec changes first (`requirements.md` → `hld.md` → `lld.md`), then the change flows down to code. A spec that has drifted from the code is a bug in the spec.

### P2 — Gates are non-negotiable
Each phase ends in a gate. The agent does not cross a gate without the human's explicit sign-off, even under time pressure, even when the next step "looks obvious." This is the rule that prevents the most expensive failures. Fast sessions compress the *artifacts* (see `fast-path.md`); they never remove the *gates*.

### P3 — Traceability end-to-end
Every requirement gets a stable ID (`R1`, `R2`, …). Every HLD component, LLD class, task, and test names the requirement IDs it satisfies. A reader must be able to trace any line of code back to a requirement, and any requirement forward to the tests that prove it. Untraceable code is suspect code.

### P4 — Smallest correct solution
Build exactly what the locked requirements demand. No speculative abstraction, no "we might need it later," no framework you don't yet use. Introduce an abstraction when the second concrete caller exists — not in anticipation of one. Simplicity is a feature; complexity must be earned.

### P5 — Production quality, scaled by profile
All code is written as if a senior engineer will review it: clear names, no dead code, no commented-out blocks, errors handled deliberately. *How much* production hardening (observability, resilience, security depth) is governed by the chosen rigor profile — but baseline craftsmanship is never optional.

### P6 — Tests prove behavior
Tests are written against acceptance criteria, not against the implementation's shape. A correct implementation must pass; a plausible-but-wrong one must fail. Tests are part of the deliverable, not an afterthought.

### P7 — No invented facts
Never fabricate a number, limit, SLA, schema field, or capability. If a fact is needed and unknown, write `UNKNOWN` in the artifact and raise it at the next gate. A marked unknown is honest; a guessed fact is a landmine.

### P8 — Load-bearing decisions are recorded
Any decision that is expensive to reverse, or that a future reader would otherwise have to reverse-engineer, becomes an ADR in `decisions/` (template: `templates/adr.md`). Stack choices, concurrency strategies, data-model trade-offs, and explicit scope cuts all qualify.

### P9 — Human owns intent; agent owns execution
The human decides *what* and *whether* (confirmed at gates). The agent decides *how* and does the work (autonomously between gates). The agent proposes; the human disposes. Never assume intent the human hasn't expressed — ask at the gate.

### P10 — Small, reversible steps
Prefer many small, verifiable changes over one large leap. Each task in Phase 6 should be independently testable and, ideally, independently revertible. Keep the build green; integrate continuously.

---

## Named Anti-Patterns

When you notice one, **name it explicitly** and return to the gate or principle that prevents it. Naming the failure is half of stopping it.

| Anti-pattern | What it looks like | Prevented by |
|--------------|--------------------|--------------|
| **Premature design** | Sketching architecture before requirements are locked. | G1 (Requirements Lock) |
| **Scope-latch** | Fixing on an early/partial reading; later requirements don't fit. | Phase-1 clarify loop + out-of-scope list |
| **Requirements-drift** | A new requirement quietly breaks the design; the agent patches forward instead of looping back. | Loop back to the earliest affected gate (P1) |
| **Gate-skipping** | "It's simple, let's just code it." | P2 |
| **Context-loss** | A later phase forgets why an earlier choice was made. | Traceability IDs (P3) |
| **Over-engineering** | Abstractions, layers, or config for needs that don't exist. | Smallest correct solution (P4) |
| **Invented facts** | Plausible numbers or constraints with no source. | No invented facts (P7) |
| **Vibe-coding** | Writing code with no spec to trace it to. | Specs as source of truth (P1, P3) |

---

## The One-Line Test

Before crossing any gate, the agent asks itself: **"Can the next phase be done correctly using only the artifacts produced so far?"** If no, the current artifact is incomplete — finish it before the gate, don't paper over it after.
