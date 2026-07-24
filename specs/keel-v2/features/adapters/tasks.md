---
artifact: tasks
phase: 6
gate: "—"
status: draft
updated: 2026-07-21
---

# Tasks — adapters

**Run:** keel-v2 · **LLD:** `./lld.md` · **Spec-check:** `./spec-check.md`

Status: `[ ]` todo · `[~]` in progress · `[x]` done (its check passes)

Two of the three adapters already ship (init writes the Claude Code matchers and the commit hook).
This feature tests the hook's mandate behaviour and adds the GitHub Action.

## Wave 1 — no dependencies

### T1 — prove the commit hook obeys "omit, never invent"
- **Goal:** run the installed `prepare-commit-msg` against real commits and assert M5.
- **Done when:** a commit with `KEEL_AGENT_MODEL` set carries an `Agent-Model` trailer; a commit
  with no `KEEL_*` env carries no trailer block at all; an unset value produces no line; a trailer
  already present is not duplicated.
- **Files:** `packages/core/src/scaffold/hook.test.ts` · **Depends on:** — · **Satisfies:** R11, M5
- `[x]`

### T2 — the composite GitHub Action
- **Goal:** `action.yml` running `npx @keel-dev/cli check --ci`, plus a README for it.
- **Done when:** the action file is valid composite-action YAML pointing at the CLI; a doc explains
  wiring it as a required check.
- **Files:** `packages/action/action.yml`, `packages/action/README.md` · **Depends on:** — · **Satisfies:** R12
- `[x]`

---

## Breakdown checklist
- [x] Every task's **Goal** and **Done when** read clearly on their own
- [x] Dependencies form no cycles; no two tasks in a wave touch the same file
- [x] Each task is small enough that its "Done when" is a single observable check
