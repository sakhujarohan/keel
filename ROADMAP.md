# Roadmap

**Status:** `v2.0.0-alpha`. All six gates of the `keel-v2` run are sealed, 229 tests pass, and Keel
enforces its own repo at 0 blocking findings. Not yet published to npm — see
[README § Status](README.md#status--roadmap) for how to run it from source today.

This file is the live, canonical answer to "what's next." It supersedes the narrative roadmap in
[`specs/keel-v2/plan-of-record.md` §9](specs/keel-v2/plan-of-record.md#9--roadmap), which remains as
the historical record of what the v2 run itself planned. Anything below that isn't yet in that run's
locked scope (`specs/keel-v2/requirements.md` § Out of Scope) is called out as such.

Each item states *what* and *why now*; deferred items also state *why deferred* and *what would
trigger the fix*, following the pattern set by the v2 ship review.

---

## v2.0.0 — first published release

- **Make the packages publishable.** `packages/core/package.json` `exports` resolves to
  `./src/index.ts` — raw TypeScript, not something a registry install can consume. The CLI hides this
  today because `build.js` bundles core in with esbuild (`bundle: true`), but publishing core as its
  own package needs either a real build or a decision not to publish it standalone. Related: neither
  package declares a `files` field (npm would ship `src/`, `test/`, fixtures alongside the assets that
  must ship); there's no `prepublishOnly` and `dist/` is gitignored, so a clean clone + `npm publish`
  today would ship a `bin` pointing at a file that doesn't exist; and `packages/cli/package.json`
  depends on `"@keel-dev/core": "*"`, a workspace wildcard that can't survive publication as a semver
  range. This also carries the bundler question: `packages/cli/build.js` (esbuild) already produces
  and CI already exercises the publish bundle, so the "no `tsup` wired" cut recorded during the v2 run
  is stale — closing it here rather than adding a second bundler, unless the packaging work above
  changes that answer.
- **Claim the `@keel-dev` npm scope and publish.** Flip both packages off `"private": true` and
  publish, once the above is settled. Today the CLI only runs from a clone (`npx tsx
  packages/cli/src/main.ts` or `npm link`); this is what makes `npx @keel-dev/cli init` work with no
  clone. It also un-inerts `packages/action` — `action.yml` already calls `npx @keel-dev/cli check
  --ci`, which is a no-op until the package exists on the registry. Irreversible once done: a claimed
  scope and a published version number can't be taken back.
- **Fix the asset-bundle version drift (release-blocking).** `packages/core/assets/agent/**` and
  `packages/core/assets/templates/**` are hand-maintained byte copies of the root `AGENTS.md`,
  `principles.md`, `workflow/`, `profiles/`, `tools/`, `skills/`, `templates/`, `.claude/commands/`,
  `.claude/agents/` — no sync script, no CI check. They've already diverged: root
  `templates/VERSION` is `1.4.0` (matching this repo's own `keel.yaml`), but
  `packages/core/assets/templates/VERSION` is `2.0.0`. `scaffold/init.ts` reads the **assets** copy
  when writing a new repo's `keel.yaml` — so `keel init` today scaffolds `templates_version: 2.0.0`
  while Keel's own repo runs `1.4.0`. KC-12 can't catch this: it only compares `keel.yaml` against
  `templates/VERSION` within a single repo, and both sides of the drift are locally self-consistent.
  Publishing freezes this into every install. Fix: make `packages/core/assets/**` derived (a
  `prebuild` copy step, or a CI check that fails on divergence) and reconcile the version numbers.
- **No way to suppress or waive a check finding (release-blocking, undecided).** `keel.yaml` is a
  `z.strictObject` with four keys (`schema`, `templates_version`, `specs_dir`, `telemetry`) and there
  is no suppression mechanism anywhere — no `.keelignore`, no per-rule override, no pragma. Nine of
  the thirteen rules block at exit 1. The first adopter who hits a false positive, or has a
  legitimately deferred feature KC-06 doesn't recognize, has no path but forking. `keel-sec-guard`
  (the sister project) ships `.secguardignore` for exactly this reason; Keel ships nothing equivalent
  for itself. **The shape of the fix is not settled**: `specs/keel-v2/requirements.md` Literal Mandate
  M4 fixes rule severities (KC-01…KC-09 block, KC-10…KC-13 warn) as a locked spec, enforced by
  construction in `check/catalog.ts`'s frozen `SEVERITIES` table — so a per-rule severity override
  would diverge from a sealed mandate, while a finding-level waiver (filtered in `report.ts` before
  the exit-code decision) would leave M4 untouched. Either way, it should land *before* publish —
  `keel.yaml`'s strict schema means adding keys later is a breaking change for CLIs already in the
  wild.
- **CI coverage matches the support matrix.** `requirements.md` assumption A4 declares macOS + Linux
  supported (Windows explicitly not); `.github/workflows/ci.yml` runs `ubuntu-latest` only. Add a
  macOS leg (and a second Node version) before the support claim goes on the npm listing.
- **Supply-chain hygiene for a public package.** `.secguardignore` currently mutes a "Supply Chain"
  finding on the unpinned `actions/checkout@v4` action — defensible pre-publish, not after. Pin to a
  SHA and add `npm publish --provenance`.

## v2.0.x — patch list

The ten deferred items recorded at the v2 ship review
([`review-checklist.md` § Known limitations](specs/keel-v2/review-checklist.md#known-limitations--v20x-candidates)),
each already carrying its own trigger condition:

1. KC-07 has no "feature has no `spec-check.md` at all" arm — fix when a run ships a feature that
   skipped Phase 5 unnoticed.
2. The `.keel/` dirty-tree exemption is a prefix match, not a content check — fix if `.keel/` ever
   holds anything but the append-only ledger.
3. sha256 repositories are coded for but have no CI coverage — fix when one is reported, or add a CI
   matrix leg.
4. Windows is unsupported (WSL works) — fix on real demand.
5. KC-12 is narrowed to template-version drift rather than full framework-doc self-consistency —
   revisit only if the original intent is wanted as a Keel-repo-specific CI rule.
6. KC-13 scans only the last 200 commits — make configurable if a large monorepo needs more.
7. A seal and its frontmatter projection aren't transactional — a crash between them needs a
   `reopen`+`pass` to recover; fix if a real crash-recovery report appears.
8. G6 is per-run, not per-feature — add per-feature gating only if runs grow large enough to need it.
9. The maintainer's own chore-commits carry no attribution trailers (this repo's hook was added by
   hand, not via `keel init`) — cosmetic; run `keel init` here or accept the KC-13 warnings.
10. *(Telemetry was originally listed here — moved to v2.1 below, where its scope actually sits.)*

Newly added:

- **A human-readable rule catalog.** Today the only way to learn what KC-09 means is to read
  `packages/core/src/check/rules/gates.ts`. Add a `docs/rules.md` (or similar) covering KC-01..KC-13
  — what each checks and how to fix a failure — and point to it from `keel check` output.
- **Coverage thresholds in Vitest.** 229 tests and no coverage tooling configured, for a project whose
  entire pitch is enforcement rigor.

## v2.1

Already out of the v2 run's locked scope (assumption A1):

- Telemetry (D5) — off by default; full design not yet locked.
- Brownfield `keel survey`, for gating changes to existing (non-Keel-native) codebases.

## v2.2

- The published benchmark.
- Template / profile registry.

## v3

- GitHub App delivering verified `keel[bot]` identities — upgrades ADR
  [0002](decisions/0002-ledger-as-gate-truth-working-tree-seals.md)'s asserted-`actor` trade-off with
  no ledger format change.
- Policy engine.

## Unscheduled candidates

Recorded, not yet committed to a release:

- `keel check --explain <rule>` for inline rule documentation without leaving the terminal.
- Per-feature G6 gating (see the v2.0.x item above — same trigger).
- `.claude/agent-memory/reviewer/MEMORY.md` is currently an empty scaffold with only commented
  examples; populate once the reviewer subagent has real run history to learn from.
