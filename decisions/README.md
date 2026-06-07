# decisions/

Architecture Decision Records, accumulated across runs. One ADR per **load-bearing** decision — anything expensive to reverse, or that a future reader would otherwise have to reverse-engineer (stack choices, concurrency strategies, data-model trade-offs, explicit scope cuts).

**Naming:** `NNNN-short-title.md`, zero-padded, monotonically increasing (`0001-use-postgres-for-acid.md`).

**Template:** `../templates/adr.md`.

**Status lifecycle:** `Proposed → Accepted → Superseded by ADR-XXXX`. Never delete a superseded ADR — mark it superseded and link forward. The history is the value.
