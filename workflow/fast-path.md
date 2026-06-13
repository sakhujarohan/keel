# Fast Path — Time-Boxed & Rapid Work

For work under a tight time budget — prototypes, spikes, hackathons, tight deadlines. **Same gates, leaner artifacts.** The whole reason the gates exist is to protect you when there's no time to recover from a wrong turn — so under pressure they become *more* important, not less.

Use this overlay when the time budget set in Phase 0 is tight (roughly: a few hours, not a few days). Everything in `workflow/lifecycle.md` still applies; this page tells you what to compress.

---

## The non-negotiables (never cut these)

- **G1 — Requirements Lock.** Even with five minutes, confirm the problem and the out-of-scope list before designing. The classic time-boxed failure is always the same: design starts before requirements are stable, and there's no time to recover. The clarify loop is the single highest-value thing you do under time pressure.
- **G2/G3 — A design and a stack decision exist *before* code.** They can be a whiteboard-level sketch, but they exist and are confirmed.
- **Traceability of the critical requirements.** You don't need IDs on everything; you need to know which two or three requirements dominate, and to keep them in view.

---

## What to compress

| Phase | Full path | Fast path |
|-------|-----------|-----------|
| 0 Kickoff | `context.md` | One line: mode, budget, profile (usually `prototype`). Bootstrap the renderer (or accept Mermaid fallback explicitly). |
| 1 Requirements | Full EARS list + NFRs + out-of-scope | The 5–8 requirements that matter, in plain testable sentences, **plus an explicit out-of-scope list and any Literal Mandates**. Still gate at G1 (clarify loop + confirmed assumptions). |
| 2 HLD | C4 levels 1–3 + sequence diagrams | One component sketch + one sequence diagram for the critical flow. Answer the 1–2 critical design questions out loud. Gate at G2. |
| 3 Stack | Candidates + ADRs | State the stack in one or two sentences with the driver. No ADR unless asked. Gate at G3 (often folded into G2). |
| 4 LLD | Per-feature class diagrams + contracts | A quick class sketch + the key signatures for the one feature you're building. Gate at G4. |
| 5 Spec-Compliance | Full ledger per feature | One-pass check: tick each Literal Mandate against the LLD. Flag any ✗ immediately. Still gate at G5 — this is the cheapest minute you'll spend. |
| 6 Tasks | Dependency waves | A short ordered checklist. |
| 7 Build | Full test depth per profile | Implement the core path; test the critical behavior; note what you'd test with more time. |
| 8 Review | Full checklist | Speak the top risks (concurrency, correctness, failure handling) and the known limitations. Run the Spec-Compliance Ledger as a final backstop. |

Under tight time, **G2 and G3 are usually a single conversation**: "here's the shape, here's what I'd build it in, and why."

Even here, keep a one-screen `STATUS.md` and run `/handoff` if you might resume later — continuity is cheap insurance.

---

## Time-boxing heuristic

A rough split for a fixed budget `T`:

- **~20% — Requirements + clarify (Phase 1, G1).** The cheapest minutes you'll spend. Lock scope, confirm assumptions, capture any Literal Mandates.
- **~25% — HLD + stack (Phases 2–3, G2/G3).** Shape and tools, confirmed.
- **~10% — LLD for the first feature (Phase 4, G4).**
- **~2% — Spec-compliance check (Phase 5, G5).** Tick each Literal Mandate against the LLD. Costs minutes; saves a rebuild.
- **~38% — Build the core path (Phase 7).**
- **~5% — Surface risks and limitations (Phase 8).**

If you fall behind, cut *scope* (build fewer features end-to-end), never cut *gates* (skip the confirmation). A smaller correct thing beats a larger thing built on an unconfirmed assumption.

---

## The moving-requirements rule

If the requirements are still moving, **you are still in Phase 1** — no matter how much time has passed. Designing on top of moving requirements is the failure this entire workflow was built to prevent. Hold the gate, finish the clarify loop, then proceed.
