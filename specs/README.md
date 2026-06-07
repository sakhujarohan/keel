# specs/

One folder per **run** (a feature or a project). Created at `/kickoff` (Phase 0).

```
specs/<run>/
  context.md                      ← Phase 0: mode, budget, profile, framing
  requirements.md                 ← Phase 1 (gate G1)
  hld.md                          ← Phase 2 (gate G2)
  stack.md                        ← Phase 3 (gate G3)
  features/<feature>/
    lld.md                        ← Phase 4 (gate G4)
    tasks.md                      ← Phase 5
  review-checklist.md             ← Phase 7 (gate G5)
```

`<run>` is a short kebab-case name. Artifacts are the source of truth for the run — code is their expression. When intent changes, change the spec first, then flow it down.
