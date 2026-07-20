/**
 * The determinism contract (N1) and the loader's share of the latency budget (N3).
 *
 * The loader reads no clock, no environment and no network, so the same tree must always produce
 * byte-identical output. That property is what lets rules be pure and fixtures be trustworthy.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadRunModel } from "../src/model/load.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures");
const REPO_ROOT = join(HERE, "..", "..", "..");

/** The loader's slice of the < 2 s full-check budget, per the LLD. */
const LOADER_BUDGET_MS = 300;

describe("determinism", () => {
  it("produces byte-identical output for the same tree", async () => {
    const [first, second] = await Promise.all([
      loadRunModel(join(FIXTURES, "clean")),
      loadRunModel(join(FIXTURES, "clean")),
    ]);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("orders diagnostics the same way every time", async () => {
    const runs = await Promise.all(
      Array.from({ length: 3 }, () => loadRunModel(join(FIXTURES, "duplicate-ids"))),
    );
    const serialised = runs.map((model) => JSON.stringify(model.diagnostics));
    expect(new Set(serialised).size).toBe(1);
  });
});

describe("latency", () => {
  /** Median of five, after two warm-up loads — JIT warm-up dominates a single sample. */
  async function medianLoadMs(dir: string): Promise<number> {
    await loadRunModel(dir);
    await loadRunModel(dir);

    const samples: number[] = [];
    for (let i = 0; i < 5; i++) {
      const started = performance.now();
      await loadRunModel(dir);
      samples.push(performance.now() - started);
    }
    return samples.sort((a, b) => a - b)[2] as number;
  }

  it("loads the clean fixture inside the loader's budget", async () => {
    const elapsed = await medianLoadMs(join(FIXTURES, "clean"));
    console.info(`[N3] clean fixture: ${elapsed.toFixed(1)} ms (budget ${LOADER_BUDGET_MS} ms)`);
    expect(elapsed).toBeLessThan(LOADER_BUDGET_MS);
  });

  it("reports the cost of this repository, which is the realistic upper end", async () => {
    // Informational, not a gate: one diagram-heavy run is the heaviest thing we have to parse.
    // The number that actually matters for the hook path — a *cold* process running the bundled
    // CLI — cannot be measured until the cli package exists, and is tracked as an open risk.
    const elapsed = await medianLoadMs(REPO_ROOT);
    console.info(`[N3] this repository: ${elapsed.toFixed(1)} ms (informational)`);
    expect(elapsed).toBeLessThan(2000);
  });
});
