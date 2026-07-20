/**
 * The engine against real repositories: the fixture trees, and a temp git repo where gates can
 * actually be sealed so the gate rules have something true to read.
 */

import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createGitAnchor } from "../src/anchor/git.js";
import { buildContext } from "../src/check/context.js";
import { CATALOG, requireGate, runChecks } from "../src/check/engine.js";
import { commitSeal, prepareSeal } from "../src/gate/operations.js";

const exec = promisify(execFile);
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

let root: string;

async function git(args: string[]): Promise<string> {
  const { stdout } = await exec("git", args, { cwd: root });
  return stdout.trim();
}

async function write(path: string, contents: string): Promise<void> {
  await mkdir(join(root, path, ".."), { recursive: true });
  await writeFile(join(root, path), contents, "utf8");
}

/** A minimal but valid run: G1 sealable, one feature, one task. */
async function seedRun(): Promise<void> {
  await write("keel.yaml", "schema: 2\ntemplates_version: 2.0.0\n");
  await write(
    "specs/demo/requirements.md",
    `---
artifact: requirements
phase: 1
gate: G1
status: signed-off
updated: 2026-07-21
schema_version: 2
---

## Functional Requirements

| ID | Requirement | Acceptance criteria |
|----|-------------|---------------------|
| R1 | The system shall answer. | it answers |

## Non-Functional Requirements

| ID | Concern | Requirement | Source |
|----|---------|-------------|--------|
| N1 | Determinism | stable output | stated |

## Literal Mandates

| ID | Mandate | Source |
|----|---------|--------|
| M1 | MUST answer with 201 | spec 1.1 |

## Assumptions

| ID | Assumption | Status |
|----|------------|--------|
| A1 | single region | confirmed |
`,
  );
  await write(
    "specs/demo/hld.md",
    `---
artifact: hld
phase: 2
gate: G2
status: draft
updated: 2026-07-21
schema_version: 2
---

## Feature List

| Feature | Delivers | LLD |
|---------|----------|-----|
| \`widget\` — the only feature | R1 | \`features/widget/lld.md\` |
`,
  );
  await write(
    "specs/demo/features/widget/lld.md",
    `---
artifact: lld
phase: 4
gate: G4
status: draft
updated: 2026-07-21
schema_version: 2
---

# LLD — widget
`,
  );
}

async function contextFor(dir: string, needCommits = false) {
  return buildContext({ repoRoot: dir, anchor: createGitAnchor(dir), needCommits });
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "keel-check-"));
  await git(["init", "-q", "-b", "main"]);
  await git(["config", "user.name", "Test Person"]);
  await git(["config", "user.email", "test@example.com"]);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("the catalog", () => {
  it("contains every rule exactly once, in order", () => {
    expect(CATALOG.map((rule) => rule.id)).toEqual([
      "KC-01",
      "KC-02",
      "KC-03",
      "KC-04",
      "KC-05",
      "KC-06",
      "KC-07",
      "KC-08",
      "KC-09",
      "KC-10",
      "KC-11",
      "KC-12",
      "KC-13",
    ]);
  });
});

describe("a repository that does not use Keel", () => {
  it("passes quietly, so the CI action is safe to add anywhere", async () => {
    await write("src/app.ts", "export const x = 1;\n");
    const report = runChecks(await contextFor(root));

    expect(report.notAKeelRepo).toBe(true);
    expect(report.exitCode).toBe(0);
    expect(report.findings).toEqual([]);
  });

  it("is a finding under --strict", async () => {
    await write("src/app.ts", "export const x = 1;\n");
    const report = runChecks(await contextFor(root), { strict: true });
    expect(report.notAKeelRepo).toBe(false);
  });

  it("distinguishes a broken manifest from an absent one", async () => {
    await write("keel.yaml", "schema: 9\ntemplates_version: 1.0.0\n");
    const report = runChecks(await contextFor(root));

    expect(report.notAKeelRepo).toBe(false);
    expect(report.exitCode).toBe(1);
    expect(report.findings.some((f) => f.rule === "KC-01")).toBe(true);
  });
});

describe("gate rules against real seals", () => {
  it("blocks an HLD that exists before G1 is sealed", async () => {
    await seedRun();
    await git(["add", "-A"]);
    await git(["commit", "-q", "-m", "seed"]);

    const report = runChecks(await contextFor(root));
    const kc02 = report.findings.filter((f) => f.rule === "KC-02");

    const hldFinding = kc02.find((f) => f.path === "specs/demo/hld.md");
    expect(hldFinding?.message).toContain("keel gate pass G1");
    // The LLD is blocked too, by G3 — the whole chain is held, not just the next step.
    expect(kc02.find((f) => f.path.endsWith("lld.md"))?.message).toContain("G3");
    expect(report.exitCode).toBe(1);
  });

  it("stops blocking once G1 is genuinely sealed", async () => {
    await seedRun();
    await git(["add", "-A"]);
    await git(["commit", "-q", "-m", "seed"]);

    await commitSeal({
      repoRoot: root,
      prepared: await prepareSeal({
        repoRoot: root,
        anchor: createGitAnchor(root),
        run: "demo",
        gate: "G1",
        artifact: "specs/demo/requirements.md",
      }),
    });

    const report = runChecks(await contextFor(root));
    const hldBlocked = report.findings.filter(
      (f) => f.rule === "KC-02" && f.path === "specs/demo/hld.md",
    );
    expect(hldBlocked).toEqual([]);
  });

  it("reports a seal break, and the downstream gate that falls with it", async () => {
    await seedRun();
    await git(["add", "-A"]);
    await git(["commit", "-q", "-m", "seed"]);

    const anchor = createGitAnchor(root);
    for (const [gate, artifact] of [
      ["G1", "specs/demo/requirements.md"],
      ["G2", "specs/demo/hld.md"],
    ] as const) {
      await commitSeal({
        repoRoot: root,
        prepared: await prepareSeal({ repoRoot: root, anchor, run: "demo", gate, artifact }),
      });
    }

    await write("specs/demo/requirements.md", "# Requirements\n\nrewritten after signing\n");

    const report = runChecks(await contextFor(root));
    const kc09 = report.findings.filter((f) => f.rule === "KC-09");

    expect(
      kc09.some(
        (f) => f.message.includes("has changed") || f.message.includes("different content"),
      ),
    ).toBe(true);
    expect(kc09.some((f) => f.message.includes("cannot be trusted while G1"))).toBe(true);
    expect(report.exitCode).toBe(1);
  });

  it("flags an assumption still proposed under a sealed G1", async () => {
    await seedRun();
    const raw = await readFile(join(root, "specs/demo/requirements.md"), "utf8");
    await write("specs/demo/requirements.md", raw.replace("confirmed", "proposed"));
    await git(["add", "-A"]);
    await git(["commit", "-q", "-m", "seed"]);

    await commitSeal({
      repoRoot: root,
      prepared: await prepareSeal({
        repoRoot: root,
        anchor: createGitAnchor(root),
        run: "demo",
        gate: "G1",
        artifact: "specs/demo/requirements.md",
      }),
    });

    const report = runChecks(await contextFor(root));
    expect(report.findings.some((f) => f.rule === "KC-03")).toBe(true);
  });
});

describe("requireGate — the hook path", () => {
  beforeEach(async () => {
    await seedRun();
    await git(["add", "-A"]);
    await git(["commit", "-q", "-m", "seed"]);
  });

  it("blocks with a next action when the gate was never sealed", async () => {
    const report = requireGate({ ctx: await contextFor(root), run: "demo", gate: "G1" });

    expect(report.exitCode).toBe(1);
    expect(report.findings[0]?.message).toContain("keel gate pass G1 --run demo");
  });

  it("passes once the gate is sealed", async () => {
    await commitSeal({
      repoRoot: root,
      prepared: await prepareSeal({
        repoRoot: root,
        anchor: createGitAnchor(root),
        run: "demo",
        gate: "G1",
        artifact: "specs/demo/requirements.md",
      }),
    });

    const report = requireGate({ ctx: await contextFor(root), run: "demo", gate: "G1" });
    expect(report.exitCode).toBe(0);
    expect(report.findings).toEqual([]);
  });

  it("blocks again the moment the sealed artifact is edited", async () => {
    await commitSeal({
      repoRoot: root,
      prepared: await prepareSeal({
        repoRoot: root,
        anchor: createGitAnchor(root),
        run: "demo",
        gate: "G1",
        artifact: "specs/demo/requirements.md",
      }),
    });
    await write("specs/demo/requirements.md", "# Requirements\n\nedited\n");

    const report = requireGate({ ctx: await contextFor(root), run: "demo", gate: "G1" });
    expect(report.exitCode).toBe(1);
    expect(report.findings[0]?.message).toContain("has changed since G1 was sealed");
  });
});

describe("traceability rules", () => {
  it("flags a requirement no feature delivers, and an ID that points nowhere", async () => {
    await seedRun();
    const hld = await readFile(join(root, "specs/demo/hld.md"), "utf8");
    await write("specs/demo/hld.md", hld.replace("| R1 |", "| R9 |"));

    const report = runChecks(await contextFor(root));

    expect(report.findings.some((f) => f.rule === "KC-05" && f.message.includes("R1"))).toBe(true);
    expect(report.findings.some((f) => f.rule === "KC-11" && f.message.includes("R9"))).toBe(true);
  });

  it("flags a task graph with an unknown dependency and a same-wave file collision", async () => {
    await seedRun();
    await write(
      "specs/demo/features/widget/tasks.md",
      `---
artifact: tasks
phase: 6
gate: "—"
status: draft
updated: 2026-07-21
schema_version: 2
---

## Wave 1 — no dependencies

### T1 — first
- **Done when:** it works
- **Files:** \`src/a.ts\` · **Depends on:** — · **Satisfies:** R1
- \`[ ]\`

### T2 — collides with T1
- **Done when:** it works
- **Files:** \`src/a.ts\` · **Depends on:** T9 · **Satisfies:** R1
- \`[ ]\`
`,
    );

    const report = runChecks(await contextFor(root));
    const kc08 = report.findings.filter((f) => f.rule === "KC-08");

    expect(kc08.some((f) => f.message.includes("T9"))).toBe(true);
    expect(kc08.some((f) => f.message.includes("both touch src/a.ts"))).toBe(true);
  });

  it("flags a commit with no attribution, and accepts one that has it", async () => {
    await seedRun();
    await git(["add", "-A"]);
    await git(["commit", "-q", "-m", "anonymous work"]);

    const bare = runChecks(await contextFor(root, true));
    expect(bare.findings.some((f) => f.rule === "KC-13")).toBe(true);

    await write("src/x.ts", "export const x = 1;\n");
    await git(["add", "-A"]);
    await git([
      "commit",
      "-q",
      "-m",
      "attributed work\n\nAgent-Model: claude-opus-4-8\nAgent-Session: test-session",
    ]);

    const attributed = runChecks(await contextFor(root, true));
    const flagged = attributed.findings.filter(
      (f) => f.rule === "KC-13" && f.message.includes("attributed work"),
    );
    expect(flagged).toEqual([]);
  });

  it("says nothing about attribution when commits were not loaded", async () => {
    await seedRun();
    await git(["add", "-A"]);
    await git(["commit", "-q", "-m", "anonymous work"]);

    const report = runChecks(await contextFor(root, false));
    expect(report.findings.some((f) => f.rule === "KC-13")).toBe(false);
  });
});

describe("the fixture repositories", () => {
  it("finds nothing blocking in the clean fixture beyond its unsealed gates", async () => {
    const report = runChecks(await contextFor(join(FIXTURES, "clean")));
    // The fixture has frontmatter claiming sign-off but no ledger, which is precisely the drift
    // KC-02/KC-09/KC-10 exist to catch — so findings are expected, and none may be KC-01.
    expect(report.findings.some((f) => f.rule === "KC-01")).toBe(false);
    expect(report.findings.some((f) => f.rule === "KC-10")).toBe(true);
  });

  it("reports the broken fixtures without ever crashing", async () => {
    for (const name of ["broken-frontmatter", "missing-tables", "duplicate-ids"]) {
      const report = runChecks(await contextFor(join(FIXTURES, name)));
      expect(report.exitCode, `${name} should block`).toBe(1);
      expect(report.findings.length).toBeGreaterThan(0);
    }
  });

  it("is deterministic — the same tree yields byte-identical findings", async () => {
    const a = runChecks(await contextFor(join(FIXTURES, "duplicate-ids")));
    const b = runChecks(await contextFor(join(FIXTURES, "duplicate-ids")));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
