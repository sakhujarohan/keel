/**
 * Rules that follow the threads: mandates into spec-checks, tasks into a valid graph, IDs into
 * things that actually exist, and commits back to the agent that wrote them.
 */

import { isAnyValidId } from "../../model/ids.js";
import type { TaskRow } from "../../model/types.js";
import { defineRule, type Finding, finding, type Rule } from "../catalog.js";

/** KC-07 — a mandate with no verdict in a spec-check was never actually checked. */
export const kc07 = defineRule({
  id: "KC-07",
  description: "Every Literal Mandate is accounted for in each feature's spec-check",
  evaluate(ctx) {
    const findings: Finding[] = [];

    for (const run of ctx.model.runs) {
      const mandates = run.requirements?.mandates ?? [];
      if (mandates.length === 0) continue;

      for (const feature of run.features) {
        const specCheck = feature.specCheck;
        if (!specCheck) continue;

        // A mandate counts as addressed if its ID appears anywhere in the spec-check's tables.
        const mentioned = new Set(
          specCheck.sections.flatMap((section) =>
            section.tables.flatMap((table) =>
              table.rows.flatMap((row) => row.cells.flatMap((cell) => cell.match(/\bM\d+/g) ?? [])),
            ),
          ),
        );

        for (const mandate of mandates) {
          if (mentioned.has(mandate.id)) continue;
          findings.push(
            finding({
              rule: "KC-07",
              path: specCheck.path,
              message: `${mandate.id} has no row in this spec-check — add its ✓/✗ verdict, or record a human-confirmed exception.`,
            }),
          );
        }
      }
    }

    return findings;
  },
});

/** KC-08 — the task graph is what makes parallel execution safe; a broken one is not a plan. */
export const kc08 = defineRule({
  id: "KC-08",
  description: "The task graph is complete, acyclic, and free of same-wave file collisions",
  evaluate(ctx) {
    const findings: Finding[] = [];

    for (const run of ctx.model.runs) {
      for (const feature of run.features) {
        const tasks = feature.tasks;
        if (!tasks) continue;

        const byId = new Map(tasks.tasks.map((task) => [task.id, task]));
        const path = tasks.path;

        for (const task of tasks.tasks) {
          if (task.dod.trim().length === 0) {
            findings.push(
              finding({
                rule: "KC-08",
                path,
                line: task.line,
                message: `${task.id} has no "Done when" — state the observable check that proves it is finished.`,
              }),
            );
          }

          if (task.requirements.length === 0) {
            findings.push(
              finding({
                rule: "KC-08",
                path,
                line: task.line,
                message: `${task.id} names no requirement — add a Satisfies entry so the work traces to the spec.`,
              }),
            );
          }

          for (const dependency of task.dependsOn) {
            if (byId.has(dependency)) continue;
            findings.push(
              finding({
                rule: "KC-08",
                path,
                line: task.line,
                message: `${task.id} depends on ${dependency}, which is not a task in this file — fix the dependency.`,
              }),
            );
          }
        }

        for (const cycle of findCycles(tasks.tasks)) {
          findings.push(
            finding({
              rule: "KC-08",
              path,
              message: `Tasks ${cycle.join(" → ")} form a dependency cycle — break it; waves cannot be ordered otherwise.`,
            }),
          );
        }

        for (const collision of findWaveCollisions(tasks.tasks)) {
          findings.push(
            finding({
              rule: "KC-08",
              path,
              message: `${collision.tasks.join(" and ")} are both in wave ${collision.wave} and both touch ${collision.file} — they cannot run in parallel; move one to a later wave.`,
            }),
          );
        }
      }
    }

    return findings;
  },
});

/** KC-10 — a hand-edited "Now" block is a lie the next reader will believe. */
export const kc10 = defineRule({
  id: "KC-10",
  description: "The STATUS Now block agrees with the state derived from the ledger",
  evaluate(ctx) {
    const findings: Finding[] = [];

    for (const run of ctx.model.runs) {
      const status = run.statusFile;
      if (!status) continue;

      const statuses = ctx.gates.get(run.name) ?? [];
      const sealed = new Set(statuses.filter((s) => s.seal.kind === "sealed").map((s) => s.gate));

      for (const gate of ["G1", "G2", "G3", "G4", "G5", "G6"] as const) {
        // "G1 ✓" in the Now block is a claim the ledger must be able to back.
        const claimsSealed = new RegExp(`${gate}\\s*[✓✔]`).test(status.nowRaw);
        if (claimsSealed && !sealed.has(gate)) {
          findings.push(
            finding({
              rule: "KC-10",
              path: `${run.dir}/STATUS.md`,
              message: `The Now block shows ${gate} as signed off, but no seal in the ledger backs it — run: keel status --run ${run.name}`,
            }),
          );
        }
      }
    }

    return findings;
  },
});

/** KC-11 — an ID that points at nothing quietly severs the traceability the whole method rests on. */
export const kc11 = defineRule({
  id: "KC-11",
  description: "Every ID reference names something that exists",
  evaluate(ctx) {
    const findings: Finding[] = [];

    for (const run of ctx.model.runs) {
      const requirements = run.requirements;
      if (!requirements) continue;

      // Work legitimately traces to mandates as well as requirements — a task that says it
      // satisfies M3 is not making it up.
      const known = new Set([
        ...requirements.requirements.map((r) => r.id),
        ...requirements.nfrs.map((n) => n.id),
        ...requirements.mandates.map((m) => m.id),
        ...requirements.assumptions.flatMap((a) => (a.id ? [a.id] : [])),
      ]);

      const hld = run.hld;
      if (hld) {
        for (const feature of hld.featureList) {
          for (const id of feature.delivers) {
            if (!isAnyValidId(id) || known.has(id)) continue;
            findings.push(
              finding({
                rule: "KC-11",
                path: hld.path,
                line: feature.line,
                message: `Feature "${feature.name}" says it delivers ${id}, which is not a requirement in this run — fix the reference.`,
              }),
            );
          }
        }
      }

      for (const feature of run.features) {
        const tasks = feature.tasks;
        if (!tasks) continue;
        for (const task of tasks.tasks) {
          for (const id of task.requirements) {
            if (!isAnyValidId(id) || known.has(id)) continue;
            findings.push(
              finding({
                rule: "KC-11",
                path: tasks.path,
                line: task.line,
                message: `${task.id} says it satisfies ${id}, which is not a requirement in this run — fix the reference.`,
              }),
            );
          }
        }
      }
    }

    return findings;
  },
});

/**
 * KC-12 — template drift.
 *
 * Narrowed from the plan's "framework docs self-consistency", which cannot be evaluated in a
 * general repository: it compares the manifest's templates_version against the installed
 * templates/VERSION marker, and stays silent when templates are not installed.
 */
export const kc12 = defineRule({
  id: "KC-12",
  description: "The manifest's templates_version matches the installed templates",
  evaluate(ctx) {
    const manifest = ctx.model.manifest;
    const installed = ctx.model.templatesVersion;
    if (!manifest || installed === null) return [];
    if (manifest.templatesVersion === installed) return [];

    return [
      finding({
        rule: "KC-12",
        path: "keel.yaml",
        message: `keel.yaml declares templates ${manifest.templatesVersion} but ${installed} is installed — run: keel upgrade`,
      }),
    ];
  },
});

/** KC-13 — when a model has a bad week, this is the data that shows it. */
export const kc13 = defineRule({
  id: "KC-13",
  description: "Commits touching a run carry agent attribution, or say they were human-written",
  evaluate(ctx) {
    if (ctx.commits.length === 0) return [];

    const findings: Finding[] = [];
    for (const commit of ctx.commits) {
      const trailers = Object.keys(commit.trailers);
      const attributed = trailers.some(
        (key) => key.startsWith("Agent-") || key.startsWith("Keel-") || key === "Human-Authored",
      );
      if (attributed) continue;

      findings.push(
        finding({
          rule: "KC-13",
          path: ".git",
          message: `Commit ${commit.sha.slice(0, 7)} ("${commit.subject.slice(0, 50)}") carries no attribution — add Agent-Model/Agent-Session trailers, or a Human-Authored trailer.`,
        }),
      );
    }
    return findings;
  },
});

// ---------------------------------------------------------------------------
// graph helpers
// ---------------------------------------------------------------------------

/** Depth-first search returning each cycle once, as the path that closes it. */
function findCycles(tasks: TaskRow[]): string[][] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const state = new Map<string, "visiting" | "done">();
  const cycles: string[][] = [];
  const stack: string[] = [];

  function visit(id: string): void {
    const status = state.get(id);
    if (status === "done") return;
    if (status === "visiting") {
      const start = stack.indexOf(id);
      if (start >= 0) cycles.push([...stack.slice(start), id]);
      return;
    }

    state.set(id, "visiting");
    stack.push(id);
    for (const dependency of byId.get(id)?.dependsOn ?? []) {
      if (byId.has(dependency)) visit(dependency);
    }
    stack.pop();
    state.set(id, "done");
  }

  for (const task of tasks) visit(task.id);
  return cycles;
}

function findWaveCollisions(tasks: TaskRow[]): { wave: number; file: string; tasks: string[] }[] {
  const seen = new Map<string, string[]>();

  for (const task of tasks) {
    for (const file of task.files) {
      const key = `${task.wave} ${file}`;
      const bucket = seen.get(key);
      if (bucket) bucket.push(task.id);
      else seen.set(key, [task.id]);
    }
  }

  return [...seen.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([key, ids]) => {
      const [wave = "0", file = ""] = key.split(" ");
      return { wave: Number(wave), file, tasks: ids };
    });
}

export const traceabilityRules: Rule[] = [kc07, kc08, kc10, kc11, kc12, kc13];
