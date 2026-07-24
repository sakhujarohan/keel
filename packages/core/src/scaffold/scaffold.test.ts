import { execFile } from "node:child_process";
import { lstat, mkdir, mkdtemp, readFile, rm, stat, unlink, writeFile } from "node:fs/promises";
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

  it("scaffolds the agent operating context by default", async () => {
    const result = await init({ repoRoot: root });

    expect(result.written).toContain("AGENTS.md");
    expect(result.written).toContain("CLAUDE.md");
    expect(result.written).toContain("GEMINI.md");
    expect(result.written).toContain("principles.md");
    expect(result.written).toContain("workflow/lifecycle.md");
    expect(result.written).toContain("profiles/README.md");
    expect(result.written).toContain("tools/diagrams.md");
    expect(result.written).toContain("skills/load-testing/SKILL.md");
    expect(result.written).toContain(".claude/commands/kickoff.md");
    expect(result.written).toContain(".claude/agents/reviewer.md");

    expect(await exists("AGENTS.md")).toBe(true);
    expect(await exists("workflow/fast-path.md")).toBe(true);
  });

  it("materialises CLAUDE.md and GEMINI.md as real symlinks to AGENTS.md", async () => {
    await init({ repoRoot: root });

    const claude = await lstat(join(root, "CLAUDE.md"));
    const gemini = await lstat(join(root, "GEMINI.md"));
    expect(claude.isSymbolicLink()).toBe(true);
    expect(gemini.isSymbolicLink()).toBe(true);

    // A symlink reads the same content as its target — proves it actually resolves.
    const agents = await readFile(join(root, "AGENTS.md"), "utf8");
    expect(await readFile(join(root, "CLAUDE.md"), "utf8")).toBe(agents);
    expect(await readFile(join(root, "GEMINI.md"), "utf8")).toBe(agents);
  });

  it("skips the agent operating context under --no-agent-context, without touching the rest", async () => {
    const result = await init({ repoRoot: root, agentContext: false });

    expect(await exists("AGENTS.md")).toBe(false);
    expect(await exists("CLAUDE.md")).toBe(false);
    expect(await exists("workflow")).toBe(false);
    expect(await exists(".claude/commands")).toBe(false);

    // Everything else keel init always writes is unaffected by the flag.
    expect(await exists("keel.yaml")).toBe(true);
    expect(await exists("templates/requirements.md")).toBe(true);
    expect(await exists(".claude/settings.json")).toBe(true);
    expect(result.written).toContain("keel.yaml");
  });

  it("never overwrites a hand-edited AGENTS.md on a second run", async () => {
    await init({ repoRoot: root });
    await writeFile(join(root, "AGENTS.md"), "# My own notes\n");

    const second = await init({ repoRoot: root });

    expect(second.written).not.toContain("AGENTS.md");
    expect(second.skipped).toContain("AGENTS.md");
    expect(await readFile(join(root, "AGENTS.md"), "utf8")).toBe("# My own notes\n");
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
    expect(probe(probes, "agent context")?.ok).toBe(false);
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
    expect(probe(probes, "agent context")?.ok).toBe(true);
    // "keel on PATH" depends on this machine's actual PATH (e.g. whether `npm link` has run) —
    // not on anything `init()` writes, so it's asserted for shape here, not a fixed verdict.
    const onPath = probe(probes, "keel on PATH");
    expect(onPath).toBeDefined();
    expect(typeof onPath?.ok).toBe("boolean");
    if (!onPath?.ok) expect(onPath?.fix).toContain("npm link");
  });

  it("reports agent context as partial when some, not all, sampled files are present", async () => {
    await git(["init", "-q", "-b", "main"]);
    await init({ repoRoot: root });
    await unlink(join(root, ".claude/commands/kickoff.md"));

    const probes = await diagnose({ repoRoot: root, anchor: createGitAnchor(root) });

    const agentContext = probe(probes, "agent context");
    expect(agentContext?.ok).toBe(false);
    expect(agentContext?.detail).toMatch(/of \d+ sampled files present/);
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
