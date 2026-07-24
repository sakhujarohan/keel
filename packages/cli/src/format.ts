/**
 * The three ways Keel speaks.
 *
 *   human  — for a person at a terminal
 *   agent  — for a model: the problem, then the one next action, nothing decorative
 *   ci     — GitHub workflow annotations that land on the exact artifact line
 */

import type { CheckReport, Finding, Probe, RunState, ScaffoldResult } from "@keel-dev/core";

export type Format = "human" | "agent" | "ci";

export function renderReport(report: CheckReport, format: Format): string {
  if (report.notAKeelRepo) {
    return format === "ci"
      ? "keel: not a keel repo (no keel.yaml) — nothing to check"
      : "keel: not a keel repo (no keel.yaml) — nothing to check. Run keel init to start.";
  }

  if (format === "ci") return renderCi(report);
  if (format === "agent") return renderAgent(report);
  return renderHuman(report);
}

function renderHuman(report: CheckReport): string {
  if (report.findings.length === 0) return "✓ no findings";

  const lines = report.findings.map((finding) => {
    const mark = finding.severity === "block" ? "✗" : "!";
    return `${mark} ${finding.rule} ${location(finding)}\n    ${finding.message}`;
  });

  lines.push("", `${report.blocking} blocking · ${report.warnings} warning(s)`);
  return lines.join("\n");
}

/** One finding per line, then the single next action — written to be acted on, not admired. */
function renderAgent(report: CheckReport): string {
  if (report.findings.length === 0) return "OK";

  const lines = report.findings.map(
    (finding) =>
      `${finding.severity.toUpperCase()} ${finding.rule} ${location(finding)}: ${finding.message}`,
  );

  const first = report.findings.find((finding) => finding.severity === "block");
  if (first) lines.push("", `BLOCKED: ${first.message}`);
  return lines.join("\n");
}

/** GitHub's escaping rules for a workflow command's data (the part after the final `::`). */
function escapeData(s: string): string {
  return s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

/** GitHub's escaping rules for a workflow command's property values (`file=`, `title=`, …). */
function escapeProperty(s: string): string {
  return escapeData(s).replace(/:/g, "%3A").replace(/,/g, "%2C");
}

function renderCi(report: CheckReport): string {
  const lines = report.findings.map((finding) => {
    const level = finding.severity === "block" ? "error" : "warning";
    const position = finding.line !== undefined ? `,line=${finding.line}` : "";
    const file = escapeProperty(finding.path);
    const title = escapeProperty(finding.rule);
    // Flattened to one line for readability; escapeData then covers what survives that —
    // a lone \r (no matching \n) and any literal % — so the annotation body is never malformed.
    const msg = escapeData(finding.message.replace(/\r?\n/g, " "));
    return `::${level} file=${file}${position},title=${title}::${msg}`;
  });

  lines.push(`keel: ${report.blocking} blocking, ${report.warnings} warning(s)`);
  return lines.join("\n");
}

function location(finding: Finding): string {
  return finding.line !== undefined ? `${finding.path}:${finding.line}` : finding.path;
}

export function renderScaffold(result: ScaffoldResult): string {
  const lines = result.written.map((path) => `  ✓ ${path}`);
  for (const path of result.skipped) lines.push(`  ○ ${path} (already present — left alone)`);
  if (lines.length === 0) lines.push("  nothing to do");
  return lines.join("\n");
}

export function renderState(state: RunState): string {
  const gates = state.gates
    .map((line) => `${line.gate} ${line.glyph}${line.date ? ` (${line.date})` : ""}`)
    .join(" · ");

  return [
    `${state.run} · phase ${state.phase}/8 — ${state.phaseName}`,
    `gates  ${gates}`,
    `tasks  ${state.tasksDone}/${state.tasksTotal}`,
    `next   ${state.nextAction}`,
  ].join("\n");
}

export function renderProbes(probes: Probe[]): string {
  const lines = probes.map((probe) => {
    const mark = probe.ok ? "✓" : "✗";
    const fix = probe.fix ? `\n      fix: ${probe.fix}` : "";
    return `  ${mark} ${probe.name}: ${probe.detail}${fix}`;
  });

  const failed = probes.filter((probe) => !probe.ok).length;
  lines.push("", failed === 0 ? "all clear" : `${failed} finding(s)`);
  return lines.join("\n");
}
