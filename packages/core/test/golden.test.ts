/**
 * Golden fixtures: whole repositories in, a summary of the model out.
 *
 * Each fixture is a small but real repository exercising one situation the loader must handle.
 * The summary keeps the snapshots readable — the point is behaviour (what was extracted, what was
 * diagnosed), not the shape of the markdown AST.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadRunModel } from "../src/model/load.js";
import type { RepoModel } from "../src/model/types.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

const CASES = [
  "clean",
  "no-manifest",
  "malformed-manifest",
  "broken-frontmatter",
  "missing-tables",
  "duplicate-ids",
  "v1-era",
] as const;

/** Everything a rule would care about, and nothing else. */
function summarise(model: RepoModel) {
  return {
    manifest: model.manifest,
    runs: model.runs.map((run) => ({
      name: run.name,
      dir: run.dir,
      artifacts: {
        context: run.context?.frontmatter,
        requirements: run.requirements?.frontmatter,
        hld: run.hld?.frontmatter,
        stack: run.stack?.frontmatter,
        conventions: run.conventions?.frontmatter,
        review: run.review?.frontmatter,
      },
      hasStatusSplit: run.statusFile !== undefined,
      requirements: run.requirements?.requirements.map((r) => `${r.id}: ${r.text}`) ?? [],
      nfrs: run.requirements?.nfrs.map((n) => `${n.id}: ${n.text}`) ?? [],
      mandates: run.requirements?.mandates.map((m) => `${m.id}: ${m.text}`) ?? [],
      mandatesExplicitNone: run.requirements?.mandatesExplicitNone ?? false,
      assumptions: run.requirements?.assumptions.map((a) => `${a.id ?? "-"}: ${a.status}`) ?? [],
      featureList: run.hld?.featureList.map((f) => `${f.name} → ${f.delivers.join(", ")}`) ?? [],
      features: run.features.map((feature) => ({
        name: feature.name,
        declaredInHld: feature.declaredInHld,
        has: {
          lld: feature.lld !== undefined,
          specCheck: feature.specCheck !== undefined,
          tasks: feature.tasks !== undefined,
        },
        tasks:
          feature.tasks?.tasks.map(
            (task) =>
              `${task.id} w${task.wave} ${task.done ? "done" : "todo"} deps=[${task.dependsOn.join(",")}] files=[${task.files.join(",")}] serves=[${task.requirements.join(",")}]`,
          ) ?? [],
      })),
    })),
    diagnostics: model.diagnostics.map((d) => `${d.code} @ ${d.path}:${d.line ?? "-"}`),
  };
}

describe("golden fixtures", () => {
  for (const name of CASES) {
    it(`loads the "${name}" repository`, async () => {
      const model = await loadRunModel(join(FIXTURES, name));
      await expect(summarise(model)).toMatchFileSnapshot(`./__snapshots__/${name}.json`);
    });
  }

  it("can see the artifact behind every one of the six gates", async () => {
    // Without stack.md (G3) and review-checklist.md (G6) in the model, a phase-order rule would
    // silently skip two gates — which is how amendment 3 was found.
    const model = await loadRunModel(join(FIXTURES, "clean"));
    const run = model.runs[0];

    const gates = [
      run?.requirements?.frontmatter.gate,
      run?.hld?.frontmatter.gate,
      run?.stack?.frontmatter.gate,
      run?.features[0]?.lld?.frontmatter.gate,
      run?.features[0]?.specCheck?.frontmatter.gate,
      run?.review?.frontmatter.gate,
    ];
    expect(gates).toEqual(["G1", "G2", "G3", "G4", "G5", "G6"]);
  });

  it("accepts `status: set`, which v1 context artifacts use", async () => {
    const model = await loadRunModel(join(FIXTURES, "clean"));
    expect(model.runs[0]?.context?.frontmatter.status).toBe("set");
    expect(model.diagnostics).toEqual([]);
  });

  it("treats a v1 repository as schema 1 without complaint", async () => {
    const model = await loadRunModel(join(FIXTURES, "v1-era"));
    expect(model.runs[0]?.requirements?.frontmatter.schemaVersion).toBe(1);
    expect(model.diagnostics).toEqual([]);
  });

  it("keeps reading a table after a bad row", async () => {
    const model = await loadRunModel(join(FIXTURES, "duplicate-ids"));
    const ids = model.runs[0]?.requirements?.requirements.map((r) => r.id);
    expect(ids).toEqual(["R1"]);
    expect(model.diagnostics.map((d) => d.code)).toEqual(
      expect.arrayContaining(["id-duplicate", "id-malformed"]),
    );
  });
});
