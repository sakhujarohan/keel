---
artifact: spec-check
phase: 5
gate: G5
status: signed-off
updated: 2026-07-21
---

# Spec-Compliance Review — scaffold

**Run:** keel-v2 · **Feature:** scaffold · **Profile:** standard (testing → production)

The CLI is where every mandate becomes observable behaviour, so this check reads them as *user-facing
promises* rather than internal contracts.

---

## Literal Mandates (from requirements.md)

| ID | Mandate | Source |
|----|---------|--------|
| M1 | Ledger entries carry exactly the eight fields plus optional `dirty`/`legacy`; `artifact_hash` is `git hash-object` of the signed content. | plan §5 |
| M2 | `keel gate pass` refuses on a dirty tree; `--allow-dirty` stamps `dirty: true`. | plan §11 D4 |
| M3 | `keel check` exits non-zero iff ≥ 1 block finding; warns never affect the exit code. | plan §6 |
| M4 | Severities fixed: KC-01…09 block, KC-10…13 warn. | plan §6 |
| M5 | Attribution trailers exactly as named; absent values omitted, never invented. | plan §5, D6 |
| M6 | Verification only; sole exception (A5) is artifact state frontmatter. | plan §1 + A5 |
| M7 | Ledger at `.keel/gates.jsonl`, keyed by run. | plan §11 D2 |
| M8 | `keel upgrade` refuses on a dirty tree; backfilled entries carry `legacy: true`. | plan §10 |
| M9 | Git identity for `actor`, upgradeable without a format change. | plan §11 D3 |

---

## Spec-Compliance Ledger

| ID | Clause | LLD specifies | Match? | Resolution |
|----|--------|---------------|--------|------------|
| M2a | `gate pass` refuses on a dirty tree | The command delegates to `prepareSeal`, which owns the refusal; the CLI adds no bypass of its own | ✓ | — |
| M2b | `--allow-dirty` stamps `dirty: true` | Flag is passed through to `prepareSeal`; the CLI cannot set `dirty` itself | ✓ | — |
| M3a | Exit non-zero iff block findings | Exit codes assigned in exactly one place, the CLI's top-level handler; `0` clean or warn-only, `1` blocking, `2` environment | ✓ | — |
| M3b | Environment failures stay outside the iff | `KeelError`/`GateRefusal` → **2**, so "keel is broken" and "keel says no" are distinguishable by a hook | ✓ | — |
| M4 | Severities fixed | The CLI renders severities; it never assigns one | ✓ | — |
| M6a | Verification only | `init` and `run new` create files **that do not exist**, from shipped templates — scaffolding empty structure, not authoring content into a human's artifact. Existing files are never overwritten | ✓ | Recorded below |
| M6b | The A5 exception | After a gate event the CLI calls `setArtifactState` (state fields) and `writeStatus` (derived zone) — both from state-projection, whose G5 already recorded that boundary | ✓ | — |
| M1, M7, M9 | ledger format, location, identity | Not exercised: the CLI never constructs an entry; it passes arguments to `prepareSeal` | ✓ (n/e) | — |
| M5 | trailer names | Not exercised here — `init` *installs* the hook that writes them, but the hook's content is the adapters feature | ✓ (n/e) | — |
| M8 | upgrade | Wired as a command in the `upgrade` feature; its refusals belong there | ✓ (n/e) | — |

---

## Mismatches & Resolutions

### 1. Does `init` writing template files violate "verification only"? ⚠ recorded

M6 says the CLI never authors spec or code content. `keel init` writes a dozen markdown files.

**Why it is not authoring.** The templates are *empty structure* shipped with the package — headings
and placeholder tables with nothing said in them. R1 requires this ("write `keel.yaml`, install the
v2 templates, wire the configured adapters"), so the locked requirement already directs it. The
boundary M6 protects is that Keel never writes **the content of a human's artifact**: it never fills
a requirement, never drafts a design, never decides. Copying an empty form is the opposite of
deciding.

**The safeguard that makes this true rather than merely argued:** `init` never overwrites. Anything
already present is skipped and reported. Keel cannot destroy or alter authored content even by
mistake.

**Recommendation:** accept, with the never-overwrite rule treated as the load-bearing part of the
claim rather than an implementation nicety.

### 2. Consent is refused, not assumed, in non-interactive use

`gate pass` prints the prepared seal and waits. Piped into a script with no `--yes`, it **refuses**
rather than proceeding. A sign-off that nobody actually saw is precisely the thing this product
exists to eliminate, so silence must never read as agreement.

---

## G5 — Spec-Compliance Lock

- [x] Every Literal Mandate has been checked against the LLD
- [x] All ✗ mismatches are either fixed or carry a documented, human-confirmed exception
- [x] **Human has confirmed: spec-compliance is satisfied for this feature**
