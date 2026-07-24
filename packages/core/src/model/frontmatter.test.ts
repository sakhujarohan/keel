import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "./frontmatter.js";

const parse = (
  raw: string,
  expectedType: Parameters<typeof parseFrontmatter>[0]["expectedType"] = "requirements",
) => parseFrontmatter({ raw, path: "specs/demo/requirements.md", expectedType });

describe("parseFrontmatter", () => {
  it("reads a v2 block", () => {
    const { frontmatter, diagnostics } = parse(`---
artifact: requirements
phase: 1
gate: G1
status: signed-off
updated: 2026-07-13
schema_version: 2
---

# Requirements
`);
    expect(diagnostics).toEqual([]);
    expect(frontmatter).toEqual({
      artifact: "requirements",
      phase: 1,
      gate: "G1",
      status: "signed-off",
      updated: "2026-07-13",
      schemaVersion: 2,
    });
  });

  it("treats a missing schema_version as v1 — this is how upgrade finds legacy artifacts", () => {
    const { frontmatter, diagnostics } = parse(`---
artifact: requirements
phase: 1
gate: G1
status: draft
updated: 2026-06-07
---
`);
    expect(diagnostics).toEqual([]);
    expect(frontmatter.schemaVersion).toBe(1);
  });

  it("keeps `updated` a string rather than a Date", () => {
    const { frontmatter } = parse(`---
artifact: requirements
phase: 1
gate: G1
status: draft
updated: 2026-07-13
---
`);
    expect(frontmatter.updated).toBe("2026-07-13");
    expect(typeof frontmatter.updated).toBe("string");
  });

  it("ignores extra keys that v1 templates carry", () => {
    const { diagnostics, frontmatter } = parse(`---
artifact: requirements
phase: 1
gate: G1
status: draft
updated: 2026-07-13
owner: rohan
notes: whatever
---
`);
    expect(diagnostics).toEqual([]);
    expect(frontmatter.artifact).toBe("requirements");
  });

  it("reports a missing block without throwing", () => {
    const { diagnostics, frontmatter } = parse("# Requirements\n\nNo frontmatter here.\n");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe("frontmatter-missing");
    expect(diagnostics[0]?.message).toContain("add a --- block");
    expect(frontmatter.status).toBe("draft");
  });

  it("reports a bad enum and still returns the fields that parsed", () => {
    const { diagnostics, frontmatter } = parse(`---
artifact: requirements
phase: 1
gate: G9
status: signed-off
updated: 2026-07-13
---
`);
    expect(diagnostics.map((d) => d.code)).toEqual(["frontmatter-invalid"]);
    expect(diagnostics[0]?.message).toContain("gate");
    expect(frontmatter.status).toBe("signed-off");
    expect(frontmatter.gate).toBe("—");
  });

  it("reports a malformed date", () => {
    const { diagnostics } = parse(`---
artifact: requirements
phase: 1
gate: G1
status: draft
updated: 13-07-2026
---
`);
    expect(diagnostics.map((d) => d.code)).toEqual(["frontmatter-invalid"]);
    expect(diagnostics[0]?.message).toContain("YYYY-MM-DD");
  });

  it("flags a declared type that contradicts the filename", () => {
    const { diagnostics } = parse(
      `---
artifact: hld
phase: 2
gate: G2
status: draft
updated: 2026-07-13
---
`,
      "requirements",
    );
    expect(diagnostics.map((d) => d.code)).toEqual(["artifact-type-mismatch"]);
  });
});
