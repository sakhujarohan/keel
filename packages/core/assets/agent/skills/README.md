# skills/

Optional, reusable **capability modules** an agent pulls in for a specific kind of work — written in the portable `SKILL.md` pattern (progressive disclosure): a short frontmatter trigger + a focused body, with heavier reference material bundled alongside and loaded only when needed.

## Shape

```
skills/<name>/
  SKILL.md        ← frontmatter (name + description/trigger) + the how-to body
  references/     ← optional deep-dive docs, loaded on demand
  scripts/        ← optional runnable templates
```

`SKILL.md` frontmatter:

```yaml
---
name: <skill-name>
description: <when to use this — the trigger>
---
```

## Agent-agnostic

A skill is just markdown — **any** agent can read `skills/<name>/SKILL.md` and follow it. Claude Code users can additionally copy or symlink it into `.claude/skills/` so it auto-activates on its trigger. Nothing here is required; skills are an upgrade for recurring work.

## Bundled skills

- **`load-testing/`** — load & chaos testing patterns (Locust, concurrency/race tests, chaos) and the metrics to watch. Used in Phase 6/7 at the `production` profile.

External skills keel references (not vendored): the **`diagram-generation`** skill from the Kroki suite — see `tools/diagrams.md`.
