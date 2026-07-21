/**
 * @keel-dev/core — the logic layer of the Keel CLI.
 *
 * Boundaries that hold across this package (see specs/keel-v2/conventions.md):
 *   - artifact reads happen only in `model/`
 *   - git happens only in `anchor/`
 *   - findings are values; environment failures throw
 */

/** Schema version this build reads and writes (see `keel.yaml`). */
export const SCHEMA_VERSION = 2 as const;

export * from "./anchor/git.js";
export * from "./check/catalog.js";
export * from "./check/context.js";
export * from "./check/engine.js";
export * from "./check/report.js";
export * from "./check/require-gate.js";
export * from "./gate/operations.js";
export * from "./gate/refusal.js";
export * from "./ledger/event.js";
export * from "./ledger/ledger.js";
export * from "./ledger/seal.js";
export * from "./migrate/upgrade.js";
export * from "./model/frontmatter-state.js";
export * from "./model/index.js";
export * from "./model/paths.js";
export * from "./project/render.js";
export * from "./project/state.js";
export * from "./project/write.js";
export * from "./scaffold/doctor.js";
export * from "./scaffold/init.js";
