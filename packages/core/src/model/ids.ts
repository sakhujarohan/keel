/**
 * The ID grammar shared by every artifact — requirements, mandates, assumptions, tasks — and the
 * naming rule for runs and features. Rules reuse these to detect malformed and dangling IDs.
 */

export const ID_PATTERNS = {
  requirement: /^R\d+$/,
  nfr: /^N\d+$/,
  mandate: /^M\d+$/,
  assumption: /^A\d+$/,
  task: /^T\d+$/,
} as const;

export type IdKind = keyof typeof ID_PATTERNS;

/** Run and feature directory names: lower-case kebab-case, no leading/trailing/double dashes. */
export const KEBAB_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Cells that mean "nothing here" rather than a list. */
const EMPTY_CELL_TOKENS = new Set(["", "-", "—", "–", "none", "n/a", "na"]);

export function isValidId(kind: IdKind, value: string): boolean {
  return ID_PATTERNS[kind].test(value);
}

/** True for any of the five ID shapes — used when a cell may mix requirement and NFR IDs. */
export function isAnyValidId(value: string): boolean {
  for (const pattern of Object.values(ID_PATTERNS)) {
    if (pattern.test(value)) return true;
  }
  return false;
}

export function isKebabName(value: string): boolean {
  return KEBAB_NAME.test(value);
}

/**
 * Split a table cell into IDs. Authors separate them with commas or middots and often decorate
 * them with backticks or bold markers, so strip the decoration before matching. An empty or
 * placeholder cell ("—", "none") yields no IDs.
 */
export function parseIdList(cell: string): string[] {
  const trimmed = cell.trim();
  if (EMPTY_CELL_TOKENS.has(trimmed.toLowerCase())) return [];

  return trimmed
    .split(/[,·]/)
    .map((part) => part.replace(/[`*_]/g, "").trim())
    .filter((part) => part.length > 0 && !EMPTY_CELL_TOKENS.has(part.toLowerCase()));
}
