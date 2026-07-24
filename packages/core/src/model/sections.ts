/**
 * Markdown structure: H2/H3 headings and the GFM tables beneath them, with true source lines.
 *
 * This layer is deliberately dumb — it turns bytes into shape and interprets nothing. Which
 * heading means what, and which columns are required, is `extract.ts`'s business.
 *
 * Parsing runs over the *whole* file including the frontmatter block, so every line number here
 * matches the file as a human sees it in an editor.
 */

import type { Nodes, Root, RootContent } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import type { MdTable, MdTableRow, Section } from "./types.js";

const processor = unified().use(remarkParse).use(remarkGfm);

export function parseSections(raw: string): Section[] {
  const tree = processor.parse(blankFrontmatter(raw)) as Root;
  const sections: Section[] = [];
  let current: Section | undefined;

  for (const node of tree.children) {
    if (node.type === "heading" && (node.depth === 2 || node.depth === 3)) {
      current = {
        heading: toText(node),
        depth: node.depth,
        line: lineOf(node),
        tables: [],
        bullets: [],
        text: "",
      };
      sections.push(current);
      continue;
    }

    if (!current) continue;

    if (node.type === "table") {
      const table = toTable(node);
      if (table) current.tables.push(table);
      continue;
    }

    if (node.type === "list") {
      for (const item of node.children) {
        current.bullets.push({ text: collapse(toText(item)), line: lineOf(item) });
      }
      continue;
    }

    if (node.type === "paragraph") {
      const paragraph = collapse(toText(node));
      current.text = current.text ? `${current.text} ${paragraph}` : paragraph;
    }
  }

  return sections;
}

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Blank out a leading frontmatter block, keeping the line count identical.
 *
 * Without this, `---\nartifact: requirements\n---` reads as a setext H2 whose text is the YAML
 * itself — a phantom section. Blanking rather than removing is what keeps every subsequent line
 * number matching the file on disk.
 */
function blankFrontmatter(raw: string): string {
  const lines = raw.split("\n");
  if (lines[0]?.trim() !== "---") return raw;

  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      for (let j = 0; j <= i; j++) lines[j] = "";
      return lines.join("\n");
    }
  }
  return raw;
}

function toTable(node: Extract<RootContent, { type: "table" }>): MdTable | null {
  const [headerRow, ...bodyRows] = node.children;
  if (!headerRow) return null;

  const rows: MdTableRow[] = bodyRows.map((row) => ({
    cells: row.children.map((cell) => toText(cell).trim()),
    line: lineOf(row),
  }));

  return {
    headerCells: headerRow.children.map((cell) => toText(cell).trim()),
    rows,
    line: lineOf(node),
  };
}

/** Flatten a node to its visible text: `**bold**` and `` `code` `` both reduce to their content. */
function toText(node: Nodes): string {
  if ("value" in node && typeof node.value === "string") return node.value;
  if ("children" in node) return node.children.map((child) => toText(child as Nodes)).join("");
  return "";
}

function lineOf(node: Nodes): number {
  return node.position?.start.line ?? 0;
}
