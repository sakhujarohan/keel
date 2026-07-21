# ADR 0002 — The ledger is the sole gate truth; seals verify against the working tree

- **Status:** Accepted
- **Date:** 2026-07-13
- **Run:** keel-v2

## Problem & forces

Keel v1 keeps gate state in artifact frontmatter (`status: signed-off`) — human-readable, but self-asserted: a hand-edit is indistinguishable from a real sign-off, and nothing detects an artifact changing *after* it was signed. v2 adds an append-only ledger (`.keel/gates.jsonl`) with hash-anchored entries. That creates two candidate sources of truth that can disagree, and two open questions: what exactly does a seal verify against (committed HEAD content vs. the working tree), and how does breaking one seal affect downstream gates? The forces: tamper-evidence (N2), the requirement that an agent be blocked *before* building on drifted requirements (R7 + the hook path), v1 file-format compatibility, and keeping the ledger strictly append-only (M1).

## Options considered

### Option A — Frontmatter authoritative, ledger as audit log
- **How it works:** commands read `status:` from frontmatter; the ledger just records history.
- **Pros:** simplest mental model; fully v1-compatible with no projection logic.
- **Cons:** defeats the product. A hand-edited `status: signed-off` passes every check — the exact failure v2 exists to eliminate. The audit log audits nothing if it isn't consulted.

### Option B — Both authoritative, must agree
- **How it works:** frontmatter and ledger are independently trusted; disagreement is an error.
- **Pros:** catches drift between the two.
- **Cons:** classic dual-write problem — every gate operation must update both atomically or manufacture spurious errors; ambiguous arbitration when they disagree ("which one is lying?").

### Option C — Ledger authoritative; frontmatter is a maintained projection ← chosen
- **How it works:** the hash-anchored ledger entry is the only thing that makes a gate "sealed." The CLI writes frontmatter `status`/`updated` on gate events (the A5 exception) so files still read exactly as v1 expects; rule KC-10 flags a projection that drifted, but never trusts it.
- **Pros:** single, tamper-evident truth; hand-edits to frontmatter are detectable noise, not forged sign-offs; v1 readability preserved.
- **Cons:** the CLI must write into artifacts (the one carve-out from verification-only, M6/A5); projection logic is code that can have bugs — mitigated by KC-10 checking it.

**Seal target — working tree, not HEAD:** `check` compares the ledger's `artifact_hash` against `git hash-object` of the file *as it sits on disk*. An uncommitted edit to sealed requirements must block the agent immediately — the working tree is what the next phase would actually build on. In CI, the checked-out tree *is* the working tree, so one code path serves both (R12).

**Invalidation — derived, never stored:** "G1 broke, so G2–G6 are invalid" is computed at read time from the gate dependency order. No invalidation records are written. The ledger stays append-only, and restoring the artifact to its sealed content heals everything with zero cleanup — correctness is a function of state, not of event-ordering bookkeeping.

## Decision

Option C, with working-tree seal verification and derived invalidation. The ledger is what a sign-off *is*; frontmatter is how humans read it.

## Pitfalls & limitations of the chosen option

Git identity in `actor` is asserted, not authenticated (accepted in plan decision D3; verified identities arrive with the v3 GitHub App). Whitespace-only edits to a sealed artifact still break the seal — `hash-object` is exact; this is deliberate (no semantic-equivalence judgment calls) but will occasionally annoy someone fixing a typo, who must re-confirm the gate. Deleting `.keel/gates.jsonl` triggers a blocking KC-09 integrity failure in `keel check`; the ledger file must be protected like any source of record (CODEOWNERS, required CI check).

## Consequences

- **Positive:** forged sign-offs become mechanically detectable; loop-back ("return to the earliest affected gate") stops being an instruction and becomes computed state; append-only ledger keeps history honest.
- **Negative / trade-off:** one sanctioned write path into artifacts to maintain; exact-hash seals trade convenience for unambiguity.
- **Follow-ups:** KC-10 (projection consistency) and KC-09 (seal integrity) are the tests of this ADR in rule form; the v3 GitHub App upgrades `actor` to a verified identity with no ledger format change.
