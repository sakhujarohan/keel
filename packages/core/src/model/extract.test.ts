import { describe, expect, it } from "vitest";
import { extractFeatureList, extractRequirements, extractTasks, splitStatus } from "./extract.js";
import { parseSections } from "./sections.js";

const PATH = "specs/demo/requirements.md";
const at = (raw: string) => parseSections(raw);

describe("requirements extraction", () => {
  const GOOD = `## Functional Requirements

| ID | Requirement (EARS) | Acceptance criteria |
|----|--------------------|---------------------|
| R1 | When asked, the system shall answer. | it answers |
| R2 | The system shall persist. | survives restart |

## Non-Functional Requirements

| ID | Concern | Requirement | Source |
|----|---------|-------------|--------|
| N1 | Determinism | same input, same output | stated |

## Literal Mandates

| ID | Mandate | Source |
|----|---------|--------|
| M1 | MUST return 201 on create | spec 3.2 |

## Assumptions

| ID | Assumption | Status |
|----|------------|--------|
| A1 | single region for v1 | confirmed (2026-07-13) |
| A2 | auth handled upstream | proposed |
`;

  it("reads functional requirements", () => {
    const { requirements, diagnostics } = extractRequirements(at(GOOD), PATH);
    expect(diagnostics).toEqual([]);
    expect(requirements.map((r) => r.id)).toEqual(["R1", "R2"]);
    expect(requirements[0]?.text).toBe("When asked, the system shall answer.");
    expect(requirements[0]?.acceptance).toBe("it answers");
  });

  it("joins an NFR's concern and requirement into one sentence", () => {
    const { nfrs } = extractRequirements(at(GOOD), PATH);
    expect(nfrs[0]).toMatchObject({
      id: "N1",
      text: "Determinism — same input, same output",
      acceptance: "stated",
    });
  });

  it("reads mandates and assumption status", () => {
    const { mandates, mandatesExplicitNone, assumptions } = extractRequirements(at(GOOD), PATH);
    expect(mandates[0]).toMatchObject({ id: "M1", source: "spec 3.2" });
    expect(mandatesExplicitNone).toBe(false);
    expect(assumptions.map((a) => [a.id, a.status])).toEqual([
      ["A1", "confirmed"],
      ["A2", "proposed"],
    ]);
  });

  it("accepts an explicit None for mandates", () => {
    const { mandates, mandatesExplicitNone, diagnostics } = extractRequirements(
      at(`## Literal Mandates

None — this spec states no verbatim mandates.
`),
      PATH,
    );
    expect(mandates).toEqual([]);
    expect(mandatesExplicitNone).toBe(true);
    expect(
      diagnostics.filter((d) => d.path === PATH && d.message.includes("Literal Mandates")),
    ).toEqual([]);
  });

  it("flags a mandates section that is neither populated nor explicitly None", () => {
    const { diagnostics } = extractRequirements(at("## Literal Mandates\n\nTBD.\n"), PATH);
    expect(diagnostics.map((d) => d.code)).toContain("table-missing");
  });

  it("drops a malformed row but keeps the rest of the table", () => {
    const { requirements, diagnostics } = extractRequirements(
      at(`## Functional Requirements

| ID | Requirement | Acceptance criteria |
|----|-------------|---------------------|
| R1 | first | ok |
| Rx | broken id | ok |
| R3 | third | ok |
`),
      PATH,
    );
    expect(requirements.map((r) => r.id)).toEqual(["R1", "R3"]);
    expect(diagnostics.map((d) => d.code)).toContain("id-malformed");
  });

  it("reports a duplicate ID", () => {
    const { requirements, diagnostics } = extractRequirements(
      at(`## Functional Requirements

| ID | Requirement | Acceptance criteria |
|----|-------------|---------------------|
| R1 | first | ok |
| R1 | again | ok |
`),
      PATH,
    );
    expect(requirements).toHaveLength(1);
    expect(diagnostics.map((d) => d.code)).toContain("id-duplicate");
  });

  it("reports a missing section and a missing table distinctly", () => {
    const missingSection = extractRequirements(at("## Something Else\n"), PATH);
    expect(missingSection.diagnostics.map((d) => d.code)).toContain("section-missing");

    const missingTable = extractRequirements(
      at("## Functional Requirements\n\njust prose\n"),
      PATH,
    );
    expect(missingTable.diagnostics.map((d) => d.code)).toContain("table-missing");
  });

  it("reports a header row without the required columns", () => {
    const { diagnostics } = extractRequirements(
      at(`## Functional Requirements

| Thing | Note |
|-------|------|
| a | b |
`),
      PATH,
    );
    expect(diagnostics.map((d) => d.code)).toContain("column-missing");
  });
});

describe("HLD feature list", () => {
  it("takes the feature name from the leading token and reads what it delivers", () => {
    const { featureList, diagnostics } = extractFeatureList(
      at(`## Feature List

| Feature | Delivers | LLD |
|---------|----------|-----|
| \`run-model\` — schema + loader | R3, R4 | \`features/run-model/lld.md\` |
| \`gate-ledger\` — the ledger | R5 · R6 | \`features/gate-ledger/lld.md\` |
`),
      "specs/demo/hld.md",
    );
    expect(diagnostics).toEqual([]);
    expect(featureList.map((f) => [f.name, f.delivers])).toEqual([
      ["run-model", ["R3", "R4"]],
      ["gate-ledger", ["R5", "R6"]],
    ]);
  });
});

describe("tasks extraction (headings and bullets)", () => {
  const TASKS = `## Wave 1 — no dependencies

### T1 — Monorepo bootstrap
- **Goal:** Stand up the workspace: config, deps, scripts.
- **Done when:** fresh clone → \`npm run check\` passes.
- **Files:** \`package.json\`, \`biome.json\` · **Depends on:** — · **Satisfies:** N4
- \`[x]\` — done on 2026-07-20

## Wave 2 — depends on Wave 1

### T2 — Types and the ID grammar
- **Goal:** the public surface as TypeScript.
- **Done when:** the grammar tests pass.
- **Files:** \`packages/core/src/model/types.ts\` · **Depends on:** T1 · **Satisfies:** R3, R4
- \`[ ]\`
`;

  it("reads id, title, wave and status", () => {
    const { tasks, diagnostics } = extractTasks(at(TASKS), "specs/demo/tasks.md");
    expect(diagnostics).toEqual([]);
    expect(tasks.map((t) => [t.id, t.title, t.wave, t.done])).toEqual([
      ["T1", "Monorepo bootstrap", 1, true],
      ["T2", "Types and the ID grammar", 2, false],
    ]);
  });

  it("reads the labelled bullet even when several labels share one line", () => {
    const [first, second] = extractTasks(at(TASKS), "specs/demo/tasks.md").tasks;
    expect(first?.files).toEqual(["package.json", "biome.json"]);
    expect(first?.dependsOn).toEqual([]);
    expect(first?.requirements).toEqual(["N4"]);
    expect(second?.dependsOn).toEqual(["T1"]);
    expect(second?.requirements).toEqual(["R3", "R4"]);
  });

  it("keeps a Done-when value whole, flattened to visible text", () => {
    // Code spans reduce to their content: the model stores what a reader sees, not the markup.
    const [first] = extractTasks(at(TASKS), "specs/demo/tasks.md").tasks;
    expect(first?.dod).toBe("fresh clone → npm run check passes.");
  });

  it("flags a task that sits outside any wave", () => {
    const { tasks, diagnostics } = extractTasks(
      at("### T9 — orphan\n- **Done when:** never\n- `[ ]`\n"),
      "specs/demo/tasks.md",
    );
    expect(tasks[0]?.wave).toBe(0);
    expect(diagnostics.map((d) => d.code)).toEqual(["row-malformed"]);
  });
});

describe("STATUS.md split", () => {
  it("splits the derived zone from the append-only log", () => {
    const { statusSplit, diagnostics } = splitStatus(
      "# Run Status\n\n## Now\n\n- Phase: 1\n\n## Session log\n\n### 2026-07-20\n- did things\n",
      "specs/demo/STATUS.md",
    );
    expect(diagnostics).toEqual([]);
    expect(statusSplit?.nowRaw).toContain("- Phase: 1");
    expect(statusSplit?.nowRaw).not.toContain("Session log");
    expect(statusSplit?.sessionLogRaw.startsWith("## Session log")).toBe(true);
  });

  it("reports a status file with no session log", () => {
    const { statusSplit, diagnostics } = splitStatus("# Run Status\n\n## Now\n", "STATUS.md");
    expect(statusSplit).toBeUndefined();
    expect(diagnostics.map((d) => d.code)).toEqual(["status-split-missing"]);
  });
});
