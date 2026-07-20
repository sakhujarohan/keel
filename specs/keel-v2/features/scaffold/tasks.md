---
artifact: tasks
phase: 6
gate: "—"
status: draft
updated: 2026-07-21
---

# Tasks — scaffold

**Run:** keel-v2 · **LLD:** `./lld.md` · **Spec-check:** `./spec-check.md`

Status: `[ ]` todo · `[~]` in progress · `[x]` done (its check passes)

Four tasks: the scaffolding core (init, run new, doctor), the CLI package that exposes every
command, and an end-to-end drive of the real binary.

## Wave 1 — no dependencies (file-disjoint)

### T1 — init and run new
- **Goal:** `init` (manifest, templates, `templates/VERSION`, `.claude` matchers merged not clobbered,
  the commit hook) and `createRun`, both idempotent and never overwriting.
- **Done when:** a first `init` writes the files and a second reports them all skipped with the tree
  byte-identical; `init` merges into an existing `.claude/settings.json` without losing its other
  keys, and leaves invalid JSON untouched; `createRun` rejects a non-kebab name and refuses an
  existing run.
- **Files:** `packages/core/src/scaffold/init.ts`, `packages/core/src/scaffold/init.test.ts` · **Depends on:** — · **Satisfies:** R1, R2
- `[ ]`

### T2 — doctor
- **Goal:** `diagnose` — read-only probes of git, identity, commits, tree, manifest, ledger and hook
  wiring, each with a fix when it fails.
- **Done when:** a bare temp dir reports "not a git repository" and "not a keel repository"; a fully
  set-up repo reports all clear; a repo with a mangled ledger line flags the ledger probe.
- **Files:** `packages/core/src/scaffold/doctor.ts`, `packages/core/src/scaffold/doctor.test.ts` · **Depends on:** — · **Satisfies:** R14, N6
- `[ ]`

## Wave 2 — depends on T1, T2

### T3 — the @keel-dev/cli package
- **Goal:** commander wiring for every command, the three output formats, and the exit-code contract
  computed in one place. `gate pass` prints the seal, then confirms before writing.
- **Done when:** the package typechecks and builds; `renderReport` emits `::error` annotations under
  `--ci` and a single next action under `--format agent`; unit tests cover the format functions.
- **Files:** `packages/cli/**`, `packages/cli/src/format.test.ts` · **Depends on:** T1, T2 · **Satisfies:** R3–R9, R14, M3
- `[ ]`

## Wave 3 — depends on T3

### T4 — drive the real binary end-to-end
- **Goal:** the S1–S5 product-flow walkthrough executed against the actual CLI in a temp git repo.
- **Done when:** `keel init` → `run new` → seal G1 with `--yes` → the ledger and STATUS both update →
  editing the sealed file makes `keel check` exit 1 → `keel status` re-projects the ⚠ → `keel doctor`
  reports the wiring. All asserted on real process exit codes and file contents.
- **Files:** `packages/cli/test/cli.e2e.test.ts` · **Depends on:** T3 · **Satisfies:** R1–R9, R14
- `[ ]`

---

## Breakdown checklist
- [x] Every task's **Goal** and **Done when** read clearly on their own
- [x] Dependencies form no cycles; no two tasks in a wave touch the same file
- [x] Each task is small enough that its "Done when" is a single observable check
