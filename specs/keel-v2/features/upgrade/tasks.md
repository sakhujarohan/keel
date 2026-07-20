---
artifact: tasks
phase: 6
gate: "—"
status: draft
updated: 2026-07-21
---

# Tasks — upgrade

**Run:** keel-v2 · **LLD:** `./lld.md` · **Spec-check:** `./spec-check.md`

Status: `[ ]` todo · `[~]` in progress · `[x]` done (its check passes)

Two tasks: the migrator, then the concrete acceptance test against a real v1 run.

## Wave 1 — no dependencies

### T1 — the migrator
- **Goal:** `upgrade` — clean-tree guard, write `keel.yaml`, bump `schema_version` to 2 on every v1
  artifact, backfill the ledger from `signed-off` frontmatter with `legacy: true`.
- **Done when:** a synthetic v1 repo migrates — manifest written, frontmatter bumped, legacy entries
  appended with the right gate and `legacy: true`; a dirty tree is refused; re-running is a no-op;
  an artifact with no frontmatter is skipped, not errored.
- **Files:** `packages/core/src/migrate/upgrade.ts`, `packages/core/src/migrate/upgrade.test.ts` · **Depends on:** — · **Satisfies:** R13, M8
- `[ ]`

## Wave 2 — depends on T1

### T2 — migrate examples/ticket-booking for real
- **Goal:** the acceptance test the requirement names — a copy of `examples/ticket-booking` migrates
  with zero manual edits and then passes `keel check` with no seal breaks.
- **Done when:** after `upgrade`, every ticket-booking artifact reads `schema_version: 2`, the ledger
  holds a legacy entry per signed-off artifact, and `keel check` reports no KC-09 seal break.
- **Files:** `packages/core/src/migrate/ticket-booking.test.ts` · **Depends on:** T1 · **Satisfies:** R13
- `[ ]`

---

## Breakdown checklist
- [x] Every task's **Goal** and **Done when** read clearly on their own
- [x] Dependencies form no cycles; no two tasks in a wave touch the same file
- [x] Each task is small enough that its "Done when" is a single observable check
