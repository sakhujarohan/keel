import type { CheckReport } from "@keel-dev/core";
import { describe, expect, it } from "vitest";
import { renderReport } from "./format.js";

function report(over: Partial<CheckReport> = {}): CheckReport {
  return {
    findings: [],
    blocking: 0,
    warnings: 0,
    exitCode: 0,
    notAKeelRepo: false,
    ...over,
  };
}

const blockFinding = {
  rule: "KC-02" as const,
  severity: "block" as const,
  path: "specs/demo/hld.md",
  line: 12,
  message: "hld.md exists while G1 is not sealed — run: keel gate pass G1 --run demo",
};

describe("renderReport", () => {
  it("emits GitHub annotations under --ci", () => {
    const out = renderReport(report({ findings: [blockFinding], blocking: 1, exitCode: 1 }), "ci");
    expect(out).toContain("::error file=specs/demo/hld.md,line=12,title=KC-02::");
    expect(out).toContain("keel: 1 blocking, 0 warning(s)");
  });

  it("keeps a CI annotation on one line even when the message has newlines", () => {
    const multiline = { ...blockFinding, message: "first line\nsecond line" };
    const out = renderReport(report({ findings: [multiline], blocking: 1, exitCode: 1 }), "ci");
    const annotation = out.split("\n").find((l) => l.startsWith("::error"));
    expect(annotation).toContain("first line second line");
  });

  it("gives an agent one next action", () => {
    const out = renderReport(
      report({ findings: [blockFinding], blocking: 1, exitCode: 1 }),
      "agent",
    );
    expect(out).toContain("BLOCK KC-02");
    expect(out).toContain("BLOCKED: hld.md exists while G1 is not sealed");
  });

  it("says OK to an agent when clean", () => {
    expect(renderReport(report(), "agent")).toBe("OK");
  });

  it("explains a non-keel repo rather than staying silent", () => {
    const out = renderReport(report({ notAKeelRepo: true }), "human");
    expect(out).toContain("not a keel repo");
    expect(out).toContain("keel init");
  });

  it("does not let a warning read as blocking", () => {
    const warn = { ...blockFinding, rule: "KC-11" as const, severity: "warn" as const };
    const out = renderReport(report({ findings: [warn], warnings: 1, exitCode: 0 }), "human");
    expect(out).toContain("0 blocking · 1 warning(s)");
  });
});
