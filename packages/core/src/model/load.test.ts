import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { KeelError } from "./errors.js";
import { loadRunModel } from "./load.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "keel-load-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function write(relativePath: string, contents: string): Promise<void> {
  const absolute = join(root, relativePath);
  await mkdir(join(absolute, ".."), { recursive: true });
  await writeFile(absolute, contents, "utf8");
}

const frontmatter = (type: string, extra = "") =>
  `---\nartifact: ${type}\nphase: 1\ngate: G1\nstatus: signed-off\nupdated: 2026-07-20\nschema_version: 2\n---\n${extra}`;

async function seedTwoRuns(): Promise<void> {
  await write("keel.yaml", "schema: 2\ntemplates_version: 2.0.0\n");

  await write("specs/alpha/context.md", frontmatter("context"));
  await write(
    "specs/alpha/requirements.md",
    frontmatter(
      "requirements",
      `
## Functional Requirements

| ID | Requirement | Acceptance criteria |
|----|-------------|---------------------|
| R1 | The system shall load. | it loads |

## Non-Functional Requirements

| ID | Concern | Requirement | Source |
|----|---------|-------------|--------|
| N1 | Determinism | same tree, same model | stated |

## Literal Mandates

| ID | Mandate | Source |
|----|---------|--------|
| M1 | MUST be append-only | plan §5 |

## Assumptions

| ID | Assumption | Status |
|----|------------|--------|
| A1 | single region | confirmed |
`,
    ),
  );
  await write(
    "specs/alpha/hld.md",
    frontmatter(
      "hld",
      `
## Feature List

| Feature | Delivers | LLD |
|---------|----------|-----|
| \`loader\` — reads things | R1 | \`features/loader/lld.md\` |
`,
    ),
  );
  await write(
    "specs/alpha/STATUS.md",
    "# Run Status\n\n## Now\n\n- Phase: 2\n\n## Session log\n\n### 2026-07-20\n- started\n",
  );
  await write("specs/alpha/features/loader/lld.md", frontmatter("lld"));
  await write(
    "specs/alpha/features/loader/tasks.md",
    frontmatter(
      "tasks",
      `
## Wave 1 — no dependencies

### T1 — Build the loader
- **Done when:** it loads
- **Files:** \`src/load.ts\` · **Depends on:** — · **Satisfies:** R1
- \`[x]\`
`,
    ),
  );

  await write("specs/beta/context.md", frontmatter("context"));
}

describe("loadRunModel", () => {
  it("loads runs, artifacts, features and tasks", async () => {
    await seedTwoRuns();
    const model = await loadRunModel(root);

    expect(model.manifest).toMatchObject({ schema: 2, specsDir: "specs" });
    expect(model.runs.map((run) => run.name)).toEqual(["alpha", "beta"]);

    const alpha = model.runs[0];
    expect(alpha?.requirements?.requirements.map((r) => r.id)).toEqual(["R1"]);
    expect(alpha?.requirements?.mandates.map((m) => m.id)).toEqual(["M1"]);
    expect(alpha?.hld?.featureList.map((f) => f.name)).toEqual(["loader"]);
    expect(alpha?.features.map((f) => [f.name, f.declaredInHld])).toEqual([["loader", true]]);
    expect(alpha?.features[0]?.tasks?.tasks[0]).toMatchObject({ id: "T1", wave: 1, done: true });
    expect(alpha?.statusFile?.sessionLogRaw.startsWith("## Session log")).toBe(true);
    expect(model.diagnostics).toEqual([]);
  });

  it("marks a feature directory the HLD never declared", async () => {
    await seedTwoRuns();
    await write("specs/alpha/features/stowaway/lld.md", frontmatter("lld"));

    const model = await loadRunModel(root);
    expect(model.runs[0]?.features.map((f) => [f.name, f.declaredInHld])).toEqual([
      ["loader", true],
      ["stowaway", false],
    ]);
  });

  it("narrows to one run with runFilter", async () => {
    await seedTwoRuns();
    const model = await loadRunModel(root, { runFilter: "alpha" });
    expect(model.runs.map((run) => run.name)).toEqual(["alpha"]);
  });

  it("treats an absent manifest as 'not a keel repo', with no diagnostics", async () => {
    await write("specs/alpha/context.md", frontmatter("context"));
    const model = await loadRunModel(root);

    expect(model.manifest).toBeNull();
    expect(model.diagnostics).toEqual([]);
    expect(model.runs).toHaveLength(1);
  });

  it("distinguishes a broken manifest from an absent one", async () => {
    await write("keel.yaml", "schema: 9\ntemplates_version: 1.0.0\n");
    const model = await loadRunModel(root);

    expect(model.manifest).toBeNull();
    expect(model.diagnostics.map((d) => d.code)).toEqual(["manifest-invalid"]);
  });

  it("never parses files outside the six recognised names", async () => {
    await seedTwoRuns();
    await write("specs/alpha/notes.md", "# Scratch\n\n| bogus |\n|---|\n| table |\n");
    await write("specs/alpha/diagrams/context.svg", "<svg></svg>");
    await write("decisions/0001-something.md", "# ADR\n");

    const model = await loadRunModel(root);
    expect(model.diagnostics).toEqual([]);
  });

  it("ignores a directory under specs/ that holds no artifacts", async () => {
    await seedTwoRuns();
    await mkdir(join(root, "specs", "not-a-run"), { recursive: true });
    await write("specs/not-a-run/README.md", "# nothing to see\n");

    const model = await loadRunModel(root);
    expect(model.runs.map((r) => r.name)).toEqual(["alpha", "beta"]);
  });

  it("flags a run directory that is not kebab-case", async () => {
    await write("specs/Not_Kebab/context.md", frontmatter("context"));
    const model = await loadRunModel(root);
    expect(model.diagnostics.map((d) => d.code)).toEqual(["run-name-invalid"]);
  });

  it("honours a custom specs_dir", async () => {
    await write("keel.yaml", "schema: 2\ntemplates_version: 2.0.0\nspecs_dir: design\n");
    await write("design/gamma/context.md", frontmatter("context"));

    const model = await loadRunModel(root);
    expect(model.runs.map((r) => r.name)).toEqual(["gamma"]);
  });

  it("returns an empty model when there is no specs directory at all", async () => {
    const model = await loadRunModel(root);
    expect(model.runs).toEqual([]);
    expect(model.diagnostics).toEqual([]);
  });

  it("throws for a root that is not a directory", async () => {
    await expect(loadRunModel(join(root, "nope"))).rejects.toBeInstanceOf(KeelError);
    await expect(loadRunModel(join(root, "nope"))).rejects.toMatchObject({ code: "ENV_BAD_ROOT" });
  });

  it("throws rather than half-loading when a file cannot be read", async () => {
    await seedTwoRuns();
    const unreadable = join(root, "specs", "alpha", "hld.md");
    await chmod(unreadable, 0o000);

    try {
      await expect(loadRunModel(root)).rejects.toMatchObject({ code: "ENV_UNREADABLE" });
    } finally {
      await chmod(unreadable, 0o644);
    }
  });

  it("returns a frozen model", async () => {
    await seedTwoRuns();
    const model = await loadRunModel(root);

    expect(Object.isFrozen(model)).toBe(true);
    expect(Object.isFrozen(model.runs)).toBe(true);
    expect(Object.isFrozen(model.runs[0])).toBe(true);
    expect(() => {
      (model.runs as unknown as { push: (value: unknown) => void }).push({});
    }).toThrow();
  });

  it("sorts diagnostics by path, then line", async () => {
    await write("specs/alpha/requirements.md", frontmatter("requirements"));
    await write("specs/beta/requirements.md", frontmatter("requirements"));

    const model = await loadRunModel(root);
    const paths = model.diagnostics.map((d) => d.path);
    expect(paths).toEqual([...paths].sort());
  });
});
