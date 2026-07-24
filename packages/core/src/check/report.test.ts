import { describe, expect, it } from "vitest";
import { finding, RULE_IDS, SEVERITIES } from "./catalog.js";
import { buildReport } from "./report.js";

describe("the severity table (mandate M4)", () => {
  it("holds exactly thirteen rules", () => {
    expect(RULE_IDS).toHaveLength(13);
  });

  it("assigns block to KC-01 through KC-09 and warn to KC-10 through KC-13", () => {
    expect(RULE_IDS.filter((id) => SEVERITIES[id] === "block")).toEqual([
      "KC-01",
      "KC-02",
      "KC-03",
      "KC-04",
      "KC-05",
      "KC-06",
      "KC-07",
      "KC-08",
      "KC-09",
    ]);
    expect(RULE_IDS.filter((id) => SEVERITIES[id] === "warn")).toEqual([
      "KC-10",
      "KC-11",
      "KC-12",
      "KC-13",
    ]);
  });

  it("cannot be edited at runtime", () => {
    expect(Object.isFrozen(SEVERITIES)).toBe(true);
  });

  it("stamps severity from the table rather than the call site", () => {
    expect(finding({ rule: "KC-01", path: "a.md", message: "x" }).severity).toBe("block");
    expect(finding({ rule: "KC-11", path: "a.md", message: "x" }).severity).toBe("warn");
  });
});

describe("the exit code (mandate M3)", () => {
  const block = finding({ rule: "KC-01", path: "a.md", message: "x" });
  const warn = finding({ rule: "KC-11", path: "a.md", message: "x" });

  it("is 0 for a clean run", () => {
    expect(buildReport([]).exitCode).toBe(0);
  });

  it("is 0 for warnings alone — warnings never block", () => {
    const report = buildReport([warn, warn, warn]);
    expect(report.warnings).toBe(3);
    expect(report.blocking).toBe(0);
    expect(report.exitCode).toBe(0);
  });

  it("is 1 as soon as one block finding exists", () => {
    expect(buildReport([warn, block]).exitCode).toBe(1);
  });

  it("is 1 regardless of how many block findings there are", () => {
    expect(buildReport([block, block, block]).exitCode).toBe(1);
  });
});

describe("finding order", () => {
  it("sorts by path, then line, then rule", () => {
    const report = buildReport([
      finding({ rule: "KC-11", path: "b.md", line: 1, message: "x" }),
      finding({ rule: "KC-01", path: "a.md", line: 9, message: "x" }),
      finding({ rule: "KC-05", path: "a.md", line: 2, message: "x" }),
      finding({ rule: "KC-02", path: "a.md", line: 2, message: "x" }),
    ]);

    expect(report.findings.map((f) => [f.path, f.line, f.rule])).toEqual([
      ["a.md", 2, "KC-02"],
      ["a.md", 2, "KC-05"],
      ["a.md", 9, "KC-01"],
      ["b.md", 1, "KC-11"],
    ]);
  });
});
