# Keel

**A mechanically-gated workflow for building software with AI agents — from problem statement to shipped, reviewed code.**

`status: v2.0.0-alpha` · `license: MIT` · not yet on npm — run from source (below)

Keel is a repeatable lifecycle — requirements → high-level design → stack selection → low-level design → task breakdown → build/test → review — with a human sign-off gate at every transition. **v1** is the methodology: prompts, templates, and slash commands any agent can follow. **v2** (this repo, `packages/`) makes the gates *mechanical*: a hash-anchored ledger records every sign-off, and `keel check` blocks a design that ran ahead of its gate or a seal that's been tampered with. v2 was built entirely under Keel's own process — [`specs/keel-v2/`](specs/keel-v2/) is the run, and Keel now passes its own check at zero blocking findings.

---

## 60-second quick start

```sh
git clone https://github.com/sakhujarohan/keel.git
cd keel && npm install
```

The CLI isn't published yet (see [Status](#status--roadmap)), so build it and link it as a real
`keel` command on your `PATH`:

```sh
npm run build
(cd packages/cli && npm link)
```

Do this rather than a shell alias: `keel init` wires a Claude Code hook (`.claude/settings.json`)
that runs `keel check --require <gate>` in a non-interactive subprocess — one that never sources
your shell's rc file, so an alias is invisible to it. `npm link` puts a real `PATH` entry in place,
which every subprocess sees, including that one. (`keel doctor` has a "keel on PATH" probe that
catches this if you skip it — see below.)

Point it at any git repo — this one or a project of your own:

```sh
cd ~/some-project        # or stay right here to try it on this repo
keel init                 # scaffold keel.yaml, templates, hooks, and the agent operating
                           # context (AGENTS.md, workflow/, principles.md, …) — never overwrites
keel run new checkout     # start a run under specs/checkout/
# … write specs/checkout/requirements.md, commit it …
keel gate pass G1 --run checkout --artifact specs/checkout/requirements.md
keel check                # verify the whole repo against the rule catalog
```

**Keel is agent-first: `keel init` scaffolds everything an agent needs by default.** Open the repo
you just `keel init`'d in Claude Code and run `/kickoff` — the slash commands, `AGENTS.md`,
`workflow/lifecycle.md`, `principles.md`, and the rest all arrived with `init`, so this works in
*any* project, not just this one. Any other agent (Codex, Cursor, Aider, Gemini): open the
project's `AGENTS.md` and follow `workflow/lifecycle.md` — it has no Claude-specific logic. Don't
want the agent bundle (a CI-only or CLI-only install)? `keel init --no-agent-context` skips it and
writes only `keel.yaml`, `templates/`, and the hooks.

## Seeing it work

Real, unedited output from the sequence above, run against a fresh repo:

```
$ keel init
  ✓ keel.yaml
  ✓ templates/…            (12 files)
  ✓ .claude/settings.json
  ✓ .git/hooks/prepare-commit-msg
  ✓ .git/hooks/pre-push
  ✓ AGENTS.md, CLAUDE.md, GEMINI.md, principles.md
  ✓ workflow/…             (2 files)   profiles/…   (4 files)   tools/…   (2 files)
  ✓ skills/…               (2 files)
  ✓ .claude/commands/…     (12 files)  .claude/agents/reviewer.md

next: keel run new <name>

$ keel run new checkout
  ✓ specs/checkout/context.md
  ✓ specs/checkout/STATUS.md

$ keel gate pass G1 --run checkout --artifact specs/checkout/requirements.md --yes
sealing:
  run       checkout
  gate      G1
  artifact  specs/checkout/requirements.md
  hash      0412277efdb6
  actor     Ada Lovelace <ada@example.com>
  commit    2278e02

G1 sealed ✓
```

Now someone edits the sealed file without re-confirming it:

```
$ keel check --run checkout --format agent
WARN KC-10 specs/checkout/STATUS.md: The Now block shows G1 as signed off, but no seal
     in the ledger backs it — run: keel status --run checkout
BLOCK KC-09 specs/checkout/requirements.md: G1 was sealed at different content than
     specs/checkout/requirements.md now holds — restore the sealed content, or
     re-confirm with your human and run: keel gate reopen G1 --run checkout

BLOCKED: G1 was sealed at different content than specs/checkout/requirements.md now holds …
$ echo $?
1
```

Restore the exact bytes that were sealed, and it heals with no cleanup step:

```
$ git checkout -- specs/checkout/requirements.md
$ keel check --run checkout
0 blocking · 2 warning(s)
$ echo $?
0
```

*(The 2 warnings are `KC-13` — the two commits above carry no `Agent-*` attribution trailer,
because they were made by a human typing `git commit` directly rather than through an agent with
the hook's environment set. That's exactly what the rule is supposed to catch.)*

## How it works

![How Keel works: an agent, a human, and CI all talk to the keel CLI, which is the only thing that reads and writes the repository's specs, ledger, and manifest](specs/keel-v2/diagrams/readme-architecture.png)

<details>
<summary>Diagram source (D2)</summary>

```d2
direction: right

agent: "Agent\nClaude Code · Cursor · Codex" { shape: person }
human: "Human" { shape: person }
ci: "CI\nGitHub Action" { shape: cloud }

cli: "keel CLI\nverification only — never authors content"

repo: "Your repository" {
  specs: "specs/<run>/\nrequirements · hld · lld · tasks …"
  ledger: ".keel/gates.jsonl\nappend-only, hash-anchored" { shape: cylinder }
  manifest: "keel.yaml"
}

agent -> cli: "phase skill blocked until\nits gate is sealed"
human -> cli: "gate pass — prints the seal,\nthen confirms before writing"
ci -> cli: "check --ci on every PR"
cli -> repo.specs
cli -> repo.ledger
cli -> repo.manifest
```

</details>

A gate isn't "sealed" because a file says `status: signed-off` — it's sealed because
`.keel/gates.jsonl` has a line whose hash matches that file's exact working-tree content, right now.
Edit the file after signing it, and the seal breaks the instant `keel check` runs — not at the next
review, not when someone happens to notice.

## Why it's built this way

The expensive failure in AI-assisted development is the agent that designs or codes before the
problem is locked, anchors on a partial reading, and produces work that has to be torn down. Keel's
gates make that failure structurally impossible: **no design before requirements are locked, no code
before the design is signed off** — and in v2, that rule is enforced by an exit code, not a
convention the agent might skip under a long context window.

It borrows proven ideas — versioned markdown specs, EARS-style acceptance criteria, an always-on
"constitution," dependency-ordered tasks, ADRs — and adds what most agent-facing frameworks lack:

| | Most agent workflows | Keel |
|---|---|---|
| Design layers | One merged "design" doc | HLD and LLD **separately gated**, with real diagrams |
| Tech choice | Assumed, or picked early | An explicit **Stack-Lock gate**, traced to a driver |
| Rigor | All-or-nothing | **Modular profiles** — toggle observability, security depth, etc. per concern |
| Sign-off | A chat message | A **hash-anchored ledger entry** that outlives the session |
| Spec fidelity | Trusted to the model | **Literal Mandates** checked against the design before code is written |

## What's in here

| Path | What it is |
|------|------------|
| `templates/` | A fill-in skeleton for every artifact. Always scaffolded by `keel init`. |

The rest, through `.claude/agents/` below, is the **agent operating context** — also scaffolded by
`keel init` into any target repo by default (`--no-agent-context` to skip just this part):

| Path | What it is |
|------|------------|
| `AGENTS.md` | The operating context for any agent. Read first. (`CLAUDE.md`, `GEMINI.md` symlink to it.) |
| `principles.md` | The constitution — always-on principles and named anti-patterns. |
| `workflow/lifecycle.md` | The full 8-phase gated playbook. |
| `workflow/fast-path.md` | Compressed overlay for time-boxed / rapid work. |
| `profiles/` | Rigor profiles and the concern-by-concern axes. |
| `tools/` | Optional toolchain setup — diagrams via the Kroki MCP. |
| `skills/` | Optional reusable capability modules (the `SKILL.md` pattern). |
| `.claude/commands/` | Claude Code slash commands for each phase. |
| `.claude/agents/` | Claude Code subagents (e.g. `reviewer` for Phase 8). |
| `packages/core` | The v2 engine: run model, gate ledger, 13-rule check engine, state projection, scaffold, migrator. |
| `packages/cli` | The `keel` binary — commander wiring, output formats, the exit-code contract. |
| `packages/action` | The GitHub Action (`check --ci`) for gating merges. |
| `specs/keel-v2/` | v2's own run — including [`plan-of-record.md`](specs/keel-v2/plan-of-record.md) (how it was designed vs. what shipped) and [`review-checklist.md`](specs/keel-v2/review-checklist.md) (the ship review). |
| `decisions/` | Architecture Decision Records. |
| `examples/` | Worked example runs — `ticket-booking` also doubles as `keel upgrade`'s acceptance test. |

## Status & roadmap

**v2.0.0-alpha**, `packages/cli` not yet published — clone, `npm run build`, and `npm link`, as above.
235 tests pass; Keel enforces its own run at 0 blocking findings.

- **Next (v2.0.0):** claim the `@keel-dev` npm scope and publish — so `npx @keel-dev/cli init`
  works without a clone or `npm link` (the esbuild bundling `packages/cli` needs for that is
  already wired).
- **v2.0.x:** a ten-item patch list of documented, deliberate deferrals — see
  [`review-checklist.md`](specs/keel-v2/review-checklist.md#known-limitations--v20x-candidates).
- **v2.1:** telemetry and a brownfield `keel survey` for gating changes to existing codebases.

Issues and PRs welcome — this is a young project and still shaping its contribution process.

## License

[MIT](LICENSE) © 2026 Rohan Sakhuja
