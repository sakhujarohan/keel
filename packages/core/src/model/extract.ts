/**
 * Turning document structure into rows.
 *
 * Every extractor follows the same contract: find the section by heading prefix, find the columns
 * by header prefix, and report anything it has to skip. A malformed row is dropped *and*
 * diagnosed — the loader never silently loses content.
 */

import { type IdKind, isValidId, parseIdList } from "./ids.js";
import type {
  AssumptionRow,
  Diagnostic,
  FeatureRow,
  MandateRow,
  MdTable,
  RequirementRow,
  Section,
  StatusSplit,
  TaskRow,
} from "./types.js";

export interface RequirementsExtract {
  requirements: RequirementRow[];
  nfrs: RequirementRow[];
  mandates: MandateRow[];
  mandatesExplicitNone: boolean;
  assumptions: AssumptionRow[];
  diagnostics: Diagnostic[];
}

// ---------------------------------------------------------------------------
// requirements.md
// ---------------------------------------------------------------------------

export function extractRequirements(sections: Section[], path: string): RequirementsExtract {
  const diagnostics: Diagnostic[] = [];

  const requirements = extractRequirementRows({
    sections,
    path,
    diagnostics,
    anchor: "Functional Requirements",
    kind: "requirement",
  });

  const nfrs = extractRequirementRows({
    sections,
    path,
    diagnostics,
    anchor: "Non-Functional Requirements",
    kind: "nfr",
  });

  const { mandates, explicitNone } = extractMandates(sections, path, diagnostics);
  const assumptions = extractAssumptions(sections, path, diagnostics);

  return {
    requirements,
    nfrs,
    mandates,
    mandatesExplicitNone: explicitNone,
    assumptions,
    diagnostics,
  };
}

function extractRequirementRows(args: {
  sections: Section[];
  path: string;
  diagnostics: Diagnostic[];
  anchor: string;
  kind: IdKind;
}): RequirementRow[] {
  const { sections, path, diagnostics, anchor, kind } = args;

  const table = requireTable({ sections, path, diagnostics, anchor });
  if (!table) return [];

  const idAt = findColumn(table, ["id"]);
  const concernAt = findColumn(table, ["concern"]);
  const requirementAt = findColumn(table, ["requirement"]);
  if (idAt < 0 || (concernAt < 0 && requirementAt < 0)) {
    diagnostics.push(columnMissing(path, table.line, anchor, "ID and Requirement"));
    return [];
  }

  // A non-functional row splits its sentence across Concern and Requirement; read both, in
  // column order, so the text reads as one statement.
  const textColumns = [...new Set([concernAt, requirementAt])]
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);
  const acceptanceAt = findColumn(table, ["acceptance", "source"]);

  const rows: RequirementRow[] = [];
  const seen = new Set<string>();

  for (const row of table.rows) {
    const id = cell(row.cells, idAt);
    if (!id) continue;
    if (!isValidId(kind, id)) {
      diagnostics.push(idMalformed(path, row.line, id, kind));
      continue;
    }
    if (seen.has(id)) {
      diagnostics.push(idDuplicate(path, row.line, id));
      continue;
    }
    seen.add(id);

    rows.push({
      id,
      text: textColumns
        .map((index) => cell(row.cells, index))
        .filter(Boolean)
        .join(" — "),
      acceptance: acceptanceAt >= 0 ? cell(row.cells, acceptanceAt) : "",
      line: row.line,
    });
  }

  return rows;
}

function extractMandates(
  sections: Section[],
  path: string,
  diagnostics: Diagnostic[],
): { mandates: MandateRow[]; explicitNone: boolean } {
  const section = findSection(sections, "Literal Mandates");
  if (!section) {
    diagnostics.push(sectionMissing(path, "Literal Mandates"));
    return { mandates: [], explicitNone: false };
  }

  const table = section.tables[0];
  const rows = table?.rows ?? [];

  // "None" written out is a deliberate statement that the spec has no literal mandates.
  if (rows.length === 0) {
    const declaresNone = /\bnone\b/i.test(section.text);
    if (!declaresNone) {
      diagnostics.push({
        code: table ? "row-malformed" : "table-missing",
        path,
        line: section.line,
        message: `${path} section "Literal Mandates" lists no mandates — add the table rows, or write "None" explicitly.`,
      });
    }
    return { mandates: [], explicitNone: declaresNone };
  }

  if (!table) return { mandates: [], explicitNone: false };

  const idAt = findColumn(table, ["id"]);
  const textAt = findColumn(table, ["mandate"]);
  const sourceAt = findColumn(table, ["source"]);
  if (idAt < 0 || textAt < 0) {
    diagnostics.push(columnMissing(path, table.line, "Literal Mandates", "ID and Mandate"));
    return { mandates: [], explicitNone: false };
  }

  const mandates: MandateRow[] = [];
  const seen = new Set<string>();

  for (const row of table.rows) {
    const id = cell(row.cells, idAt);
    if (!id) continue;
    if (!isValidId("mandate", id)) {
      diagnostics.push(idMalformed(path, row.line, id, "mandate"));
      continue;
    }
    if (seen.has(id)) {
      diagnostics.push(idDuplicate(path, row.line, id));
      continue;
    }
    seen.add(id);

    mandates.push({
      id,
      text: cell(row.cells, textAt),
      source: sourceAt >= 0 ? cell(row.cells, sourceAt) : "",
      line: row.line,
    });
  }

  return { mandates, explicitNone: false };
}

function extractAssumptions(
  sections: Section[],
  path: string,
  diagnostics: Diagnostic[],
): AssumptionRow[] {
  const table = requireTable({ sections, path, diagnostics, anchor: "Assumptions" });
  if (!table) return [];

  const idAt = findColumn(table, ["id"]);
  const textAt = findColumn(table, ["assumption"]);
  const statusAt = findColumn(table, ["status"]);
  if (textAt < 0 || statusAt < 0) {
    diagnostics.push(columnMissing(path, table.line, "Assumptions", "Assumption and Status"));
    return [];
  }

  const rows: AssumptionRow[] = [];
  for (const row of table.rows) {
    const text = cell(row.cells, textAt);
    if (!text) continue;

    const id = idAt >= 0 ? cell(row.cells, idAt) : "";
    if (id && !isValidId("assumption", id)) {
      diagnostics.push(idMalformed(path, row.line, id, "assumption"));
      continue;
    }

    // Authors write "confirmed (2026-07-13)" as often as bare "confirmed".
    const confirmed = /^confirmed/i.test(cell(row.cells, statusAt));
    rows.push({
      ...(id ? { id } : {}),
      text,
      status: confirmed ? "confirmed" : "proposed",
      line: row.line,
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// hld.md
// ---------------------------------------------------------------------------

export function extractFeatureList(
  sections: Section[],
  path: string,
): { featureList: FeatureRow[]; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const table = requireTable({ sections, path, diagnostics, anchor: "Feature List" });
  if (!table) return { featureList: [], diagnostics };

  const nameAt = findColumn(table, ["feature"]);
  const deliversAt = findColumn(table, ["delivers"]);
  const lldAt = findColumn(table, ["lld"]);
  if (nameAt < 0 || deliversAt < 0) {
    diagnostics.push(columnMissing(path, table.line, "Feature List", "Feature and Delivers"));
    return { featureList: [], diagnostics };
  }

  const featureList: FeatureRow[] = [];
  const seen = new Set<string>();

  for (const row of table.rows) {
    const name = featureName(cell(row.cells, nameAt));
    if (!name) continue;
    if (seen.has(name)) {
      diagnostics.push(idDuplicate(path, row.line, name));
      continue;
    }
    seen.add(name);

    featureList.push({
      name,
      delivers: parseIdList(cell(row.cells, deliversAt)),
      lldPath: lldAt >= 0 ? cell(row.cells, lldAt) : "",
      line: row.line,
    });
  }

  return { featureList, diagnostics };
}

/**
 * Feature cells read like "`run-model` — schema v2 + loader". Prefer the backticked token; failing
 * that, take the text before a *spaced* dash. Splitting on a bare hyphen would cut kebab-case names
 * like `gate-ledger` in half.
 */
function featureName(raw: string): string {
  const backticked = raw.match(/`([^`]+)`/);
  if (backticked?.[1]) return backticked[1].trim();

  const leading = raw.split(/\s[—–-]\s/)[0] ?? raw;
  return leading.replace(/[`*_]/g, "").trim();
}

// ---------------------------------------------------------------------------
// tasks.md — headings and bullets, not a table (LLD amendment 1)
// ---------------------------------------------------------------------------

const WAVE_HEADING = /^wave\s+(\d+)/i;
const TASK_HEADING = /^(T\d+)\s*[—–-]\s*(.+)$/;
const LABELS = ["Goal", "Done when", "Files", "Depends on", "Satisfies"] as const;
const LABEL_SCAN = /(?:^|[·|])\s*(Goal|Done when|Files|Depends on|Satisfies)\s*:\s*/gi;

export function extractTasks(
  sections: Section[],
  path: string,
): { tasks: TaskRow[]; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const tasks: TaskRow[] = [];
  const seen = new Set<string>();
  let wave = 0;

  for (const section of sections) {
    const waveMatch = section.heading.match(WAVE_HEADING);
    if (section.depth === 2 && waveMatch) {
      wave = Number(waveMatch[1]);
      continue;
    }

    const taskMatch = section.heading.match(TASK_HEADING);
    if (!taskMatch) continue;

    const id = taskMatch[1] ?? "";
    const title = (taskMatch[2] ?? "").trim();

    if (seen.has(id)) {
      diagnostics.push(idDuplicate(path, section.line, id));
      continue;
    }
    seen.add(id);

    if (wave === 0) {
      diagnostics.push({
        code: "row-malformed",
        path,
        line: section.line,
        message: `${path} task ${id} appears before any "Wave N" heading — put it under a wave so parallel execution stays safe.`,
      });
    }

    const fields = readLabelledBullets(section.bullets.map((bullet) => bullet.text));
    tasks.push({
      id,
      title,
      requirements: parseIdList(fields.Satisfies ?? ""),
      dependsOn: parseIdList(fields["Depends on"] ?? ""),
      wave,
      files: parseFileList(fields.Files ?? ""),
      done: section.bullets.some((bullet) => /\[\s*[x✓]\s*\]/i.test(bullet.text)),
      dod: fields["Done when"] ?? "",
      line: section.line,
    });
  }

  return { tasks, diagnostics };
}

/**
 * Read `**Label:** value` pairs out of bullet text. Several labels can share one bullet, separated
 * by `·`, and a value may itself contain `·` or a colon — so scan for label positions and take
 * everything up to the next label rather than splitting naively.
 */
function readLabelledBullets(bullets: string[]): Partial<Record<(typeof LABELS)[number], string>> {
  const fields: Partial<Record<(typeof LABELS)[number], string>> = {};

  for (const bullet of bullets) {
    const matches = [...bullet.matchAll(LABEL_SCAN)];
    for (const [index, match] of matches.entries()) {
      const label = normaliseLabel(match[1] ?? "");
      if (!label) continue;
      const start = (match.index ?? 0) + match[0].length;
      const end = matches[index + 1]?.index ?? bullet.length;
      const value = bullet
        .slice(start, end)
        .replace(/[·|]\s*$/, "")
        .trim();
      if (value && fields[label] === undefined) fields[label] = value;
    }
  }

  return fields;
}

function normaliseLabel(raw: string): (typeof LABELS)[number] | undefined {
  const lower = raw.toLowerCase();
  return LABELS.find((label) => label.toLowerCase() === lower);
}

function parseFileList(raw: string): string[] {
  return raw
    .split(",")
    .map((part) => part.replace(/[`*]/g, "").trim())
    .filter((part) => part.length > 0 && part !== "—" && part !== "-");
}

// ---------------------------------------------------------------------------
// STATUS.md
// ---------------------------------------------------------------------------

const SESSION_LOG_HEADING = /^##\s+Session log\s*$/im;

export function splitStatus(
  raw: string,
  path: string,
): { statusSplit?: StatusSplit; diagnostics: Diagnostic[] } {
  const match = raw.match(SESSION_LOG_HEADING);
  if (!match || match.index === undefined) {
    return {
      diagnostics: [
        {
          code: "status-split-missing",
          path,
          line: 1,
          message: `${path} has no "## Session log" heading — add it so the derived Now block and the append-only log stay separate.`,
        },
      ],
    };
  }

  return {
    statusSplit: {
      nowRaw: raw.slice(0, match.index).trimEnd(),
      sessionLogRaw: raw.slice(match.index).trimEnd(),
    },
    diagnostics: [],
  };
}

// ---------------------------------------------------------------------------
// shared helpers
// ---------------------------------------------------------------------------

/** Sections are matched by heading *prefix*, so authors can annotate headings freely. */
export function findSection(sections: Section[], anchor: string): Section | undefined {
  const needle = anchor.toLowerCase();
  return sections.find((section) => section.heading.trim().toLowerCase().startsWith(needle));
}

/** Columns are matched by header prefix too; extra columns are ignored. */
export function findColumn(table: MdTable, candidates: string[]): number {
  for (const candidate of candidates) {
    const index = table.headerCells.findIndex((header) =>
      header.trim().toLowerCase().startsWith(candidate),
    );
    if (index >= 0) return index;
  }
  return -1;
}

function requireTable(args: {
  sections: Section[];
  path: string;
  diagnostics: Diagnostic[];
  anchor: string;
}): MdTable | undefined {
  const { sections, path, diagnostics, anchor } = args;

  const section = findSection(sections, anchor);
  if (!section) {
    diagnostics.push(sectionMissing(path, anchor));
    return undefined;
  }

  const table = section.tables[0];
  if (!table) {
    diagnostics.push({
      code: "table-missing",
      path,
      line: section.line,
      message: `${path} section "${anchor}" has no table — add one with the expected columns.`,
    });
    return undefined;
  }

  return table;
}

function cell(cells: string[], index: number): string {
  return (cells[index] ?? "").trim();
}

function sectionMissing(path: string, anchor: string): Diagnostic {
  return {
    code: "section-missing",
    path,
    line: 1,
    message: `${path} has no "${anchor}" section — add it, following the template.`,
  };
}

function columnMissing(path: string, line: number, anchor: string, expected: string): Diagnostic {
  return {
    code: "column-missing",
    path,
    line,
    message: `${path} table under "${anchor}" is missing required columns (${expected}) — add them to the header row.`,
  };
}

function idMalformed(path: string, line: number, id: string, kind: IdKind): Diagnostic {
  const shape = { requirement: "R1", nfr: "N1", mandate: "M1", assumption: "A1", task: "T1" }[kind];
  return {
    code: "id-malformed",
    path,
    line,
    message: `${path} has an unreadable ${kind} ID "${id}" — use the ${shape} form.`,
  };
}

function idDuplicate(path: string, line: number, id: string): Diagnostic {
  return {
    code: "id-duplicate",
    path,
    line,
    message: `${path} reuses the ID "${id}" — IDs must be unique within an artifact.`,
  };
}
