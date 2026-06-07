# The Keel Lifecycle — Full Playbook

Read the phase you are about to run. Each phase has: **Purpose · Inputs · Activities · Artifact · Gate · Exit criteria · Watch-for.**

The Prime Directive governs all of it: **do not cross a gate without the human's explicit sign-off.** Gates are marked 🚦.

A "run" is one feature or one project. Its artifacts live in `specs/<run>/`, where `<run>` is a short kebab-case name. Create that folder in Phase 0.

---

## Run State & Continuity

Every run keeps a **`specs/<run>/STATUS.md`** (the *captain's log*) so work survives across sessions and agents.

- **Source of truth = artifact frontmatter.** Each artifact has a YAML header (`phase`, `gate`, `status`, `updated`). When a gate passes, set that artifact's `status: signed-off` and bump `updated`.
- **`STATUS.md` = `## Now`** (a *derived* snapshot — regenerate with `/status`, never hand-edit) **+ `## Session log`** (append-only, newest on top).
- **Rhythm:** `/resume` at the start of a session · `/status` to refresh after a change · `/handoff` before you stop (appends a log entry + prints a git-anchored resume packet). Agents without these commands do the same by hand.

---

## Phase 0 — Kickoff

**Purpose:** Establish the frame before any thinking about the problem. Five minutes that make the rest of the run deterministic.

**Inputs:** Whatever the human brings — a written brief, a verbal problem, or just an idea.

**Activities:**
1. Name the run and create `specs/<run>/`.
2. Determine **mode**: new project (greenfield) · feature or change in an existing codebase.
3. Determine the **time budget**. If it is tight (a spike, a tight deadline), switch to `workflow/fast-path.md` for the rest of the run — same gates, leaner artifacts.
4. Choose the **rigor profile** (`prototype` / `standard` / `production`) and note any per-concern overrides. See `profiles/`.
5. Write `specs/<run>/context.md` from `templates/context.md` — mode, budget, profile, overrides, one-line problem framing.
6. Create `specs/<run>/STATUS.md` from `templates/status.md` (the captain's log — see Run State & Continuity above).

**Artifact:** `specs/<run>/context.md` + `specs/<run>/STATUS.md`

**Gate:** none — but confirm the mode and profile with the human before moving on.

**Exit criteria:** mode, budget, and profile are written down.

**Watch-for:** *Don't* start solving the problem here. Kickoff frames the run; it does not analyze the problem.

---

## Phase 1 — Requirements

**Purpose:** Lock *what* must be true before anyone thinks about *how*. This is the phase that prevents the most expensive failures.

**Inputs:** `context.md` + the raw problem.

**Activities:**
1. Capture **functional requirements** as testable statements. Use **EARS** notation (see the template) so each is unambiguous and verifiable.
2. Capture **non-functional requirements** — performance, scale, concurrency, consistency, availability, security — but only those the problem actually implies. Mark anything unstated as `UNKNOWN`. Set **performance targets** (numbers) for any quantified NFR, and record explicit **assumptions** (deliberate defaults you're proceeding with — distinct from open questions).
3. List **constraints** — fixed tech, data formats, interfaces, deadlines.
4. List **explicit out-of-scope** items. This is half the value of the phase: it is what stops scope-latch.
5. **Clarify loop.** Ask the human every question whose answer would change the design. Batch the questions; don't dribble them. Keep asking until no design-changing ambiguity remains. For ambiguous or evolving problems, this loop is the whole game — *do not move on while the requirements are still moving.*
6. Assign each requirement a stable ID (`R1`, `R2`, …).

**Artifact:** `specs/<run>/requirements.md` (template: `templates/requirements.md`)

**Gate:** 🚦 **G1 — Requirements Lock.** Present the requirements and the out-of-scope list. Ask explicitly: *"Are these complete and stable? May I lock them?"* **Propose no design until the human confirms.**

**Exit criteria:** human has confirmed the requirements are complete and stable; every requirement has an ID; out-of-scope is explicit; no `UNKNOWN` remains that would change the design.

**Watch-for:** **Premature design** (sketching architecture in this phase), **scope-latch** (anchoring on the first reading). If the human keeps adding requirements, that's fine — it means the gate is doing its job. Stay in Phase 1.

---

## Phase 2 — High-Level Design

**Purpose:** Decide the shape of the system — its major components, their responsibilities, and how they interact — without yet choosing the stack or the class structure.

**Inputs:** Locked `requirements.md`.

**Activities:**
1. Surface the **critical design questions** — the few decisions that dominate the architecture (e.g. "how do concurrent requests stay correct?", "where does state live?", "what's the consistency model?"). Answer each, with the trade-off considered. Log them in the HLD.
2. Draw the architecture as **UML** at the right C4 levels (inline Mermaid by default; or validated SVGs via the optional Kroki toolchain — `tools/diagrams.md`):
   - **Context** (level 1): the system as a box, its users and external systems.
   - **Container** (level 2): the deployable/runnable pieces and the data stores.
   - **Component** (level 3): the major internal components and responsibilities.
   - **Key sequence diagrams**: the critical flows end-to-end (especially the ones the critical questions touch).
3. State the **data model at a conceptual level** — entities and relationships, not yet schemas.
4. Map every component back to the requirement IDs it serves (traceability).
5. Enumerate the **feature list** — the features Phase 4 will iterate, each traced to its requirement IDs (the HLD→LLD bridge).

**Artifact:** `specs/<run>/hld.md` (template: `templates/hld.md`)

**Gate:** 🚦 **G2 — HLD sign-off.** Walk the human through the diagrams and the critical-question answers. Confirm the shape is right before choosing tools.

**Exit criteria:** every requirement is served by some component; the critical design questions are answered; diagrams render and are consistent with each other.

**Watch-for:** Choosing the stack here (that's Phase 3). Drawing class-level detail here (that's Phase 4). Keep it about *shape and responsibilities*.

---

## Phase 3 — Stack Selection

**Purpose:** Choose language, framework, datastore, and key libraries — as a deliberate, recorded decision traced to the non-functional requirements. This is the moment the abstract design meets concrete tools.

**Inputs:** `hld.md` + the NFRs from `requirements.md` + the rigor profile.

**Activities:**
1. For each major choice (language, framework, datastore, messaging, key libs), list the realistic candidates and the **decision driver** — which NFR or constraint forces the choice (e.g. "ACID + relational data → Postgres", "team fluency + ecosystem → Java/Spring").
2. Where a choice is load-bearing or contested, write an **ADR** in `decisions/` (template: `templates/adr.md`).
3. Produce the **project codebook** `specs/<run>/conventions.md` (from `templates/conventions.md`): structure, conventions, key implementation patterns, and a "Do NOT" list — the manual Phase 6 follows.
4. Record the final choices and their rationale in `stack.md`.

**Artifact:** `specs/<run>/stack.md` + `specs/<run>/conventions.md` (+ ADRs in `decisions/`)

**Gate:** 🚦 **G3 — Stack Lock.** Confirm the stack with the human. After this gate, the stack is fixed for the run; changing it means returning here and re-deciding explicitly.

**Exit criteria:** every major technical choice is made and traced to a driver; load-bearing choices have ADRs; the human has locked the stack.

**Watch-for:** Choosing tools by habit or hype rather than by an NFR driver. **Invented facts** about benchmarks or limits — if you don't know a tool's real characteristic, say `UNKNOWN`.

---

## Phase 4 — Low-Level Design (per feature)

**Purpose:** Design the internals of each feature in enough detail that implementation is mechanical — classes, interfaces, concrete data model, error handling.

**Inputs:** `hld.md`, `stack.md`, the requirements for this feature.

**Activities:** for each feature in the HLD feature list (`specs/<run>/features/<feature>/`):
1. Draw a **class diagram** (Mermaid `classDiagram`, or `plantuml` via the optional Kroki toolchain — `tools/diagrams.md`) — the types, their key methods, and relationships.
2. Define the **interfaces / contracts** — public method signatures, API endpoints, message shapes.
3. Specify the **concrete data model** — tables/collections, fields, types, indexes, constraints.
4. Specify the **error model** — failure modes, what each returns/raises, transaction/rollback behavior.
5. Trace each class/contract to its requirement IDs.

**Artifact:** `specs/<run>/features/<feature>/lld.md` (template: `templates/lld.md`)

**Gate:** 🚦 **G4 — LLD sign-off** (per feature). Confirm the design before building the feature.

**Exit criteria:** a builder agent could implement the feature from this document alone (apply the One-Line Test from `principles.md`). If not, the LLD is underspecified — finish it.

**Watch-for:** **Over-engineering** — class hierarchies and patterns the requirements don't need. Design the smallest correct structure.

---

## Phase 5 — Task Breakdown (per feature)

**Purpose:** Decompose the LLD into atomic, testable, dependency-ordered tasks that one agent (or several in parallel) can execute.

**Inputs:** `lld.md` for the feature.

**Activities:**
1. Break the work into **atomic tasks** — each independently testable, ideally independently revertible, sized to a single focused change.
2. For each task: state its **definition of done**, the **requirement IDs** it advances, and its **dependencies** (which tasks must finish first).
3. Order tasks into **dependency waves**: a wave is the set of tasks whose dependencies are all satisfied; tasks within a wave can run in parallel (and on different agents). Two tasks in the same wave must not touch the same file.
4. Write tasks in the order they'll be executed.

**Artifact:** `specs/<run>/features/<feature>/tasks.md` (template: `templates/tasks.md`)

**Gate:** review (no formal sign-off, but confirm the breakdown looks right before building — cheap to fix now, expensive later).

**Exit criteria:** every task has a definition of done, dependencies, and requirement traceability; the waves are valid (no cycles, no same-file collisions within a wave).

**Watch-for:** Tasks too big to test, or tasks that smuggle in design decisions that belong in Phase 4.

---

## Phase 6 — Build & Test

**Purpose:** Implement the tasks. Produce working, tested code.

**Inputs:** `tasks.md`, `lld.md`.

**Activities:**
1. Execute tasks in dependency order. Within a wave, parallelize across agents if available.
2. For each task, work **test-first** (default for `standard`/`production`; optional for `prototype`): write the failing test(s) against the acceptance criteria, then the smallest code that passes them, run, and mark the task done only when green. Keep the build green throughout.
3. Tests target behavior (acceptance criteria), not implementation shape. The depth of testing (unit / integration / contract / e2e) is set by the rigor profile.
4. If a task reveals that the design is wrong, **stop and loop back** to the affected gate (G4, or further if needed). Do not patch forward around a broken design — that's requirements-drift.
5. Apply the profile's other concerns as you go (logging, error handling, resilience, security) — don't bolt them on at the end if the profile requires them.

**Artifact:** code + tests, committed in small steps.

**Gate:** none within the loop, but each task's tests must pass before it's marked done.

**Exit criteria:** all tasks done; all tests green; the feature satisfies its requirements.

**Watch-for:** **Vibe-coding** (code with no task behind it), patching forward around design flaws, skipping tests to "save time."

---

## Phase 7 — Harden & Review

**Purpose:** Bring the work to the rigor the profile demands, and make it presentable / shippable.

**Inputs:** the built feature(s), the rigor profile, `templates/review-checklist.md`.

**Activities:**
1. Run the **review checklist** (`templates/review-checklist.md`), scoped to the chosen profile — correctness, concurrency, error handling, observability, security, performance, docs. Complete its **Traceability & Validation Ledger** (every requirement → tests → status) and reconcile the Performance-Targets "Achieved" column.
2. Close gaps the checklist surfaces. Record any deliberate scope cuts ("no idempotency keys in this version, here's how I'd add them") in the README and/or an ADR.
3. Write/finish the **README**: how to run, the approach and key decisions, known limitations, and — if relevant — how AI was used.
4. Ensure every load-bearing decision made during the build has an **ADR** in `decisions/`.

**Artifact:** completed review checklist, README, ADRs.

**Gate:** 🚦 **G5 — Ship review.** Walk the human through the checklist results, known limitations, and the README. Confirm it's ready to ship/submit.

**Exit criteria:** checklist passes at the profile's level; known limitations are documented, not hidden; README lets a stranger run and understand it.

**Watch-for:** Hiding a limitation instead of documenting it. A known, documented gap is professional; an undocumented one is a defect.

---

## Looping Back

The lifecycle is forward-flowing but not one-way. When a later phase invalidates an earlier decision:

1. **Name it** (which anti-pattern, if any).
2. **Return to the earliest affected gate** — not the current step.
3. **Update that artifact and re-confirm the gate**, then flow the change forward.

Patching forward to avoid a loop-back is requirements-drift, and it is how designs rot. Looping back is cheap when caught early — which is exactly what the gates are for.
