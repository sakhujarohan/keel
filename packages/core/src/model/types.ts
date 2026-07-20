/**
 * The typed picture of a Keel repository.
 *
 * These types are the contract from `specs/keel-v2/features/run-model/lld.md`. Everything
 * downstream — rules, projector, migrator — reads this model and never touches markdown itself.
 */

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

/**
 * Every artifact a run can hold. `stack` carries G3 and `review` carries G6 — without them the
 * model would be blind to two of the six gates.
 */
export type ArtifactType =
  | "context"
  | "requirements"
  | "hld"
  | "stack"
  | "conventions"
  | "lld"
  | "spec-check"
  | "tasks"
  | "review";

export type Gate = "G1" | "G2" | "G3" | "G4" | "G5" | "G6";

/** `set` is what v1 context artifacts use; it means "framed", not "awaiting a gate". */
export type ArtifactStatus = "draft" | "set" | "gate-pending" | "signed-off" | "reopened";

/** The YAML block every artifact opens with. `schema_version` absent in the file means v1. */
export interface Frontmatter {
  artifact: ArtifactType;
  /** Lifecycle phase, 0–8. */
  phase: number;
  gate: Gate | "—";
  status: ArtifactStatus;
  /** `YYYY-MM-DD`, validated as a string — never coerced to a Date. */
  updated: string;
  schemaVersion: 1 | 2;
}

/** One GFM table: its header cells and rows, each carrying the source line it came from. */
export interface MdTable {
  headerCells: string[];
  rows: MdTableRow[];
  line: number;
}

export interface MdTableRow {
  cells: string[];
  line: number;
}

/** A top-level list item under a heading, flattened to its visible text. */
export interface BulletItem {
  text: string;
  line: number;
}

/**
 * An H2/H3 heading and the content beneath it. Artifacts are written three ways — tables
 * (requirements, mandates), bullets under sub-headings (tasks), and plain prose (an explicit
 * "None") — so a section exposes all three and leaves interpretation to `extract.ts`.
 */
export interface Section {
  heading: string;
  depth: 2 | 3;
  line: number;
  tables: MdTable[];
  bullets: BulletItem[];
  /** Paragraph text under this heading, whitespace-collapsed. */
  text: string;
}

export interface ArtifactDoc {
  /** Repo-relative POSIX path. */
  path: string;
  type: ArtifactType;
  frontmatter: Frontmatter;
  sections: Section[];
}

// ---------------------------------------------------------------------------
// Extracted rows
// ---------------------------------------------------------------------------

export interface RequirementRow {
  id: string;
  text: string;
  acceptance: string;
  line: number;
}

export interface MandateRow {
  id: string;
  text: string;
  source: string;
  line: number;
}

export interface AssumptionRow {
  /** Optional: v1-era requirements documents list assumptions without IDs. */
  id?: string;
  text: string;
  status: "proposed" | "confirmed";
  line: number;
}

export interface FeatureRow {
  name: string;
  /** Requirement IDs this feature delivers. */
  delivers: string[];
  lldPath: string;
  line: number;
}

export interface TaskRow {
  id: string;
  title: string;
  /** Requirement IDs this task advances. */
  requirements: string[];
  /** Task IDs that must finish first. */
  dependsOn: string[];
  wave: number;
  /** Declared touch-set, used to detect same-file collisions inside a wave. */
  files: string[];
  done: boolean;
  dod: string;
  line: number;
}

// ---------------------------------------------------------------------------
// Typed artifact specialisations
// ---------------------------------------------------------------------------

export interface RequirementsDoc extends ArtifactDoc {
  requirements: RequirementRow[];
  nfrs: RequirementRow[];
  mandates: MandateRow[];
  /** True when the Literal Mandates section says "None" rather than listing rows. */
  mandatesExplicitNone: boolean;
  assumptions: AssumptionRow[];
}

export interface HldDoc extends ArtifactDoc {
  featureList: FeatureRow[];
}

export interface TasksDoc extends ArtifactDoc {
  tasks: TaskRow[];
}

// ---------------------------------------------------------------------------
// Runs and the repository
// ---------------------------------------------------------------------------

/** `STATUS.md` split at the `## Session log` heading: derived zone vs. append-only zone. */
export interface StatusSplit {
  nowRaw: string;
  sessionLogRaw: string;
}

export interface FeatureEntry {
  name: string;
  /** True when the HLD's feature list names this feature (vs. only a directory existing). */
  declaredInHld: boolean;
  lld?: ArtifactDoc;
  specCheck?: ArtifactDoc;
  tasks?: TasksDoc;
}

export interface RunEntry {
  name: string;
  /** Repo-relative POSIX path, e.g. `specs/keel-v2`. */
  dir: string;
  context?: ArtifactDoc;
  requirements?: RequirementsDoc;
  hld?: HldDoc;
  /** G3's artifact. */
  stack?: ArtifactDoc;
  /** The project codebook — produced at G3, but gated by nothing of its own. */
  conventions?: ArtifactDoc;
  /** G6's artifact, `review-checklist.md`. */
  review?: ArtifactDoc;
  features: FeatureEntry[];
  statusFile?: StatusSplit;
}

export interface Manifest {
  schema: 2;
  templatesVersion: string;
  specsDir: string;
  telemetry: "off";
}

export interface RepoModel {
  /** Absolute path to the repository root. */
  readonly root: string;
  /** `null` when `keel.yaml` is absent — the "not a keel repo" case. */
  readonly manifest: Manifest | null;
  /** Version marker of the installed `templates/`, or null when none are installed. */
  readonly templatesVersion: string | null;
  readonly runs: readonly RunEntry[];
  readonly diagnostics: readonly Diagnostic[];
}

export interface LoadOptions {
  /** Load only this run's artifacts. Run names are still discovered. */
  runFilter?: string;
}

// ---------------------------------------------------------------------------
// Diagnostics — content problems as values, never exceptions
// ---------------------------------------------------------------------------

export type DiagCode =
  | "manifest-invalid"
  | "frontmatter-missing"
  | "frontmatter-invalid"
  | "artifact-type-mismatch"
  | "section-missing"
  | "table-missing"
  | "column-missing"
  | "row-malformed"
  | "id-malformed"
  | "id-duplicate"
  | "run-name-invalid"
  | "status-split-missing"
  // gate-ledger
  | "ledger-line-malformed"
  | "ledger-entry-invalid"
  | "ledger-unknown-run";

export interface Diagnostic {
  code: DiagCode;
  /** Repo-relative POSIX path. */
  path: string;
  line?: number;
  /** One sentence naming the problem, plus one imperative fix hint. */
  message: string;
}
