import { describe, expect, it } from "vitest";
import { parseSections } from "./sections.js";

const DOC = `---
artifact: requirements
phase: 1
---

# Requirements — demo

## Functional Requirements

Some prose that must never be parsed.

| ID | Requirement | Acceptance criteria |
|----|-------------|---------------------|
| R1 | The system shall do the thing. | it does the thing |
| R2 | The system shall do \`a \\| b\`. | both work |

### Nested detail

| Key | Value |
|-----|-------|
| a   | 1     |

## Out of Scope

- nothing here
`;

describe("parseSections", () => {
  it("finds H2 and H3 headings with their true file line numbers", () => {
    const sections = parseSections(DOC);
    expect(sections.map((s) => [s.heading, s.depth, s.line])).toEqual([
      ["Functional Requirements", 2, 8],
      ["Nested detail", 3, 17],
      ["Out of Scope", 2, 23],
    ]);
  });

  it("does not mistake the frontmatter block for a setext heading", () => {
    const sections = parseSections(DOC);
    expect(sections.map((s) => s.heading)).not.toContain("artifact: requirements\nphase: 1");
  });

  it("attaches each table to the heading above it", () => {
    const sections = parseSections(DOC);
    expect(sections[0]?.tables).toHaveLength(1);
    expect(sections[1]?.tables).toHaveLength(1);
    expect(sections[2]?.tables).toHaveLength(0);
  });

  it("reads header and body cells, with row line numbers", () => {
    const [functional] = parseSections(DOC);
    const table = functional?.tables[0];
    expect(table?.headerCells).toEqual(["ID", "Requirement", "Acceptance criteria"]);
    expect(table?.rows).toHaveLength(2);
    expect(table?.rows[0]?.cells).toEqual([
      "R1",
      "The system shall do the thing.",
      "it does the thing",
    ]);
    expect(table?.rows[0]?.line).toBe(14);
  });

  it("survives a pipe inside a code span — the case regex parsing gets wrong", () => {
    const [functional] = parseSections(DOC);
    expect(functional?.tables[0]?.rows[1]?.cells).toEqual([
      "R2",
      "The system shall do a | b.",
      "both work",
    ]);
  });

  it("keeps two tables under one heading", () => {
    const sections = parseSections(`## Only

| a |
|---|
| 1 |

| b |
|---|
| 2 |
`);
    expect(sections[0]?.tables).toHaveLength(2);
  });

  it("returns nothing for a document with no headings", () => {
    expect(parseSections("just prose\n")).toEqual([]);
  });
});
