---
artifact: lld
phase: 4
gate: G4
status: signed-off
updated: 2026-07-21
---

# LLD — adapters

**Status:** LOCKED (G4, 2026-07-21) · **Run:** keel-v2 · **Stack:** see `../../stack.md`
**Serves requirements:** R10 (block gate-skipping in-agent), R11 (attribute commits), R12 (gate merges in CI) · **Mandates:** M5 · **NFRs:** N6

The adapters carry no logic. Each is a thin shell that invokes `keel` and consumes its exit code —
which is exactly what keeps Keel agent-agnostic: a new agent is an adapter, not a code change.

---

## The three adapters

| Adapter | What it is | Serves |
|---------|------------|--------|
| **Claude Code hook** | `PreToolUse` matchers in `.claude/settings.json`, written by `keel init`, calling `keel check --require G<n> --format agent` before each phase skill. | R10 |
| **git commit-msg hook** | `.git/hooks/prepare-commit-msg`, written by `keel init`, appending `Keel-*`/`Agent-*` trailers from `KEEL_AGENT_*` env — omitting any value the environment does not supply. | R11, M5 |
| **GitHub Action** | A composite action running `npx @keel-dev/cli check --ci`, failing the job on a block finding and emitting `::error` annotations. | R12 |

**Two of the three already exist** — the Claude Code matchers and the commit hook are written by
`scaffold`'s `init` (`packages/core/src/scaffold/init.ts`). This feature verifies their content
against the mandates and adds the third: the composite Action.

## Interfaces / Contracts

### Commit hook (R11, M5) — the exact trailer set

```sh
# appended only when at least one KEEL_AGENT_* / KEEL_* value is present:
Keel-Run: <$KEEL_RUN>
Keel-Task: <$KEEL_TASK>
Agent-Tool: <$KEEL_AGENT_TOOL>
Agent-Model: <$KEEL_AGENT_MODEL>
Agent-Session: <$KEEL_AGENT_SESSION>
```

A value that is unset is **omitted, never invented** (M5). A trailer already present is not
duplicated. `Co-Authored-By` is left to the agent tool, which emits its own.

### GitHub Action (R12)

```yaml
# action.yml — composite
runs:
  using: composite
  steps:
    - run: npx @keel-dev/cli check --ci
      shell: bash
```

`check --ci` already emits `::error file=…,line=…::` annotations and sets exit 1 on a block finding,
which fails the step. Nothing in the adapter interprets findings — it only runs the CLI.

## Error Model

| Failure | Trigger | Result |
|---------|---------|--------|
| No `KEEL_AGENT_*` env | a human commit | the hook adds no trailer block at all — silence, not an empty block |
| A trailer already present | re-running the hook | not duplicated |
| `keel` not on PATH in CI | broken workflow | the CLI's own `ENV` exit 2 fails the step honestly |

## Concurrency / Consistency Notes

- **The hook writes only when it has something true to write** (M5, N5): no env, no block. This is
  what keeps the attribution dataset clean enough to be worth querying.
- **The Action holds no logic** (R12): it is `check --ci` and the exit code. Everything it could get
  wrong is already tested in the CLI.

---

## G4 — LLD Sign-off

- [x] One-Line Test passes: a builder could implement this from this doc alone
- [x] Every type/contract traces to a requirement
- [x] Error model covers every failure mode
- [x] Concurrency/consistency requirements are explicitly satisfied
- [x] **Human has confirmed the design before build**
