<!--
TEMPLATE: Stack Selection (Phase 3). Copy to specs/<run>/stack.md and fill in.
Every choice is traced to a DRIVER — an NFR or constraint that forces it. Choices "by habit" are a smell.
Load-bearing or contested choices get an ADR in decisions/ (templates/adr.md). Delete comments as you go.
-->

# Stack Selection — <run>

**Status:** DRAFT → (LOCKED after G3) · **Drivers:** see NFRs in `requirements.md`, shape in `hld.md`

---

## Decisions

| Choice | Candidates considered | Decision | Driver (NFR / constraint) | ADR |
|--------|-----------------------|----------|---------------------------|-----|
| Language | <A, B> | <chosen> | <why — which driver> | <#NNNN or —> |
| Framework | | | | |
| Data store | | | | |
| Messaging / async | | | | |
| Key libraries | | | | |
| Build / runtime | | | | |

<!-- For any row where the choice is load-bearing or was genuinely contested, write an ADR and link it. -->

## Stack Conventions

<!--
If a language/framework guideline doc governs this run (layout, idioms, naming, lint config),
agree it here and link/inline it. This is the point where stack-specific guidelines get pulled in.
-->

- Project layout: <link or description>
- Conventions / lint: <link or description>

## Known Trade-offs & Risks

<!-- What this stack makes easy, what it makes hard, and any limit you're accepting. Mark UNKNOWN honestly. -->

- <trade-off / risk>

---

## G3 — Stack Lock

- [ ] Every major choice is traced to a driver (no habit/hype picks)
- [ ] Load-bearing choices have ADRs
- [ ] Trade-offs and risks are stated (unknowns marked, not guessed)
- [ ] **Human has locked the stack** — changing it later means returning to this gate
