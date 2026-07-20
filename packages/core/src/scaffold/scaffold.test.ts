import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createGitAnchor } from "../anchor/git.js";
import { diagnose } from "./doctor.js";
import { createRun, init } from "./init.js";

const exec = promisify(execFile);
let root: string;

async function git(args: string[]): Promise<void> {
  await exec("git", args, { cwd: root });
}

async function exists(path: string): Promise<boolean> {
  return stat(join(root, path)).then(
    () => true,
    () => false,
  );
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "keel-scaffold-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("init", () => {
  it("writes the manifest, templates, version marker and hooks", async () => {
    const result = await init({ repoRoot: root });

    expect(result.written).toContain("keel.yaml");
    expect(result.written).toContain("templates/VERSION");
    expect(result.written).toContain(".claude/settings.json");
    expect(await exists("keel.yaml")).toBe(true);
    expect(await exists("templates/requirements.md")).toBe(true);

    const manifest = await readFile(join(root, "keel.yaml"), "utf8");
    expect(manifest).toContain("schema: 2");
    expect(manifest).toContain("telemetry: off");
  });

  it("is idempotent — a second run writes nothing and the tree is unchanged", async () => {
    await init({ repoRoot: root });
    const before = await readFile(join(root, "keel.yaml"), "utf8");

    const second = await init({ repoRoot: root });

    expect(second.written).toEqual([]);
    expect(second.skipped).toContain("keel.yaml");
    expect(await readFile(join(root, "keel.yaml"), "utf8")).toBe(before);
  });

  it("wires every phase skill to its gate", async () => {
    await init({ repoRoot: root });
    const settings = await readFile(join(root, ".claude/settings.json"), "utf8");

    expect(settings).toContain("Skill(hld)");
    expect(settings).toContain("keel check --require G1");
    expect(settings).toContain("Skill(implement)");
  });

  it("merges into an existing settings file without losing its keys", async () => {
    await mkdir(join(root, ".claude"), { recursive: true });
    await writeFile(
      join(root, ".claude/settings.json"),
      JSON.stringify(
        { model: "opus", hooks: { PreToolUse: [{ matcher: "Bash", hooks: [] }] } },
        null,
        2,
      ),
    );

    await init({ repoRoot: root });
    const settings = JSON.parse(await readFile(join(root, ".claude/settings.json"), "utf8"));

    expect(settings.model).toBe("opus");
    const matchers = settings.hooks.PreToolUse.map((h: { matcher: string }) => h.matcher);
    expect(matchers).toContain("Bash");
    expect(matchers).toContain("Skill(hld)");
  });

  it("leaves an unparseable settings file strictly alone", async () => {
    await mkdir(join(root, ".claude"), { recursive: true });
    await writeFile(join(root, ".claude/settings.json"), "{ not json");

    const result = await init({ repoRoot: root });

    expect(await readFile(join(root, ".claude/settings.json"), "utf8")).toBe("{ not json");
    expect(result.skipped.some((s) => s.includes("not valid JSON"))).toBe(true);
  });
});

describe("createRun", () => {
  it("creates a run with context and STATUS", async () => {
    const result = await createRun({ repoRoot: root, name: "checkout-v2" });

    expect(result.written).toContain("specs/checkout-v2/context.md");
    expect(result.written).toContain("specs/checkout-v2/STATUS.md");
    expect(await readFile(join(root, "specs/checkout-v2/STATUS.md"), "utf8")).toContain(
      "## Session log",
    );
  });

  it("rejects a name that is not kebab-case", async () => {
    await expect(createRun({ repoRoot: root, name: "My_Run" })).rejects.toMatchObject({
      code: "ENV_BAD_ROOT",
    });
  });

  it("refuses to clobber an existing run", async () => {
    await createRun({ repoRoot: root, name: "demo" });
    await expect(createRun({ repoRoot: root, name: "demo" })).rejects.toMatchObject({
      code: "ENV_BAD_ROOT",
    });
  });
});

describe("doctor", () => {
  const probe = (probes: Awaited<ReturnType<typeof diagnose>>, name: string) =>
    probes.find((p) => p.name === name);

  it("reports a bare directory as neither git nor keel", async () => {
    const probes = await diagnose({ repoRoot: root, anchor: createGitAnchor(root) });

    expect(probe(probes, "git repository")?.ok).toBe(false);
    expect(probe(probes, "manifest")?.ok).toBe(false);
    expect(probe(probes, "agent hooks")?.ok).toBe(false);
  });

  it("reports all clear for a fully set-up repo", async () => {
    await git(["init", "-q", "-b", "main"]);
    await git(["config", "user.name", "Test Person"]);
    await git(["config", "user.email", "test@example.com"]);
    await init({ repoRoot: root });
    await writeFile(join(root, "README.md"), "# demo\n");
    await git(["add", "-A"]);
    await git(["commit", "-q", "-m", "first"]);

    const probes = await diagnose({ repoRoot: root, anchor: createGitAnchor(root) });

    expect(probe(probes, "git identity")?.ok).toBe(true);
    expect(probe(probes, "commits")?.ok).toBe(true);
    expect(probe(probes, "manifest")?.ok).toBe(true);
    expect(probe(probes, "agent hooks")?.ok).toBe(true);
    expect(probes.every((p) => p.ok)).toBe(true);
  });

  it("flags a mangled ledger line", async () => {
    await git(["init", "-q", "-b", "main"]);
    await init({ repoRoot: root });
    await mkdir(join(root, ".keel"), { recursive: true });
    await writeFile(join(root, ".keel/gates.jsonl"), "{ not a valid entry\n");

    const probes = await diagnose({ repoRoot: root, anchor: createGitAnchor(root) });
    expect(probe(probes, "ledger")?.ok).toBe(false);
  });
});
