import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGitAnchor } from "../anchor/git.js";
import { commitSeal, prepareSeal } from "../gate/operations.js";
import * as loader from "../model/load.js";
import { requireGateFast } from "./require-gate.js";

const exec = promisify(execFile);
let root: string;

const REQUIREMENTS = "specs/demo/requirements.md";
const HLD = "specs/demo/hld.md";

async function git(args: string[]): Promise<string> {
  const { stdout } = await exec("git", args, { cwd: root });
  return stdout.trim();
}

async function write(path: string, contents: string): Promise<void> {
  await mkdir(join(root, path, ".."), { recursive: true });
  await writeFile(join(root, path), contents, "utf8");
}

async function seal(gate: "G1" | "G2", artifact: string): Promise<void> {
  const anchor = createGitAnchor(root);
  await commitSeal({
    repoRoot: root,
    prepared: await prepareSeal({ repoRoot: root, anchor, run: "demo", gate, artifact }),
  });
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "keel-fastgate-"));
  await git(["init", "-q", "-b", "main"]);
  await git(["config", "user.name", "Test Person"]);
  await git(["config", "user.email", "test@example.com"]);
  await write(REQUIREMENTS, "# Requirements\n\nR1 — answer.\n");
  await write(HLD, "# High-Level Design\n");
  await git(["add", "-A"]);
  await git(["commit", "-q", "-m", "seed"]);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

const ask = (gate: "G1" | "G2") =>
  requireGateFast({ repoRoot: root, anchor: createGitAnchor(root), run: "demo", gate });

describe("requireGateFast", () => {
  it("blocks when the gate was never sealed", async () => {
    const report = await ask("G1");
    expect(report.exitCode).toBe(1);
    expect(report.findings[0]?.message).toContain("keel gate pass G1 --run demo");
  });

  it("passes once the gate is sealed", async () => {
    await seal("G1", REQUIREMENTS);
    const report = await ask("G1");
    expect(report.exitCode).toBe(0);
    expect(report.findings).toEqual([]);
  });

  it("blocks the moment the sealed artifact changes", async () => {
    await seal("G1", REQUIREMENTS);
    await write(REQUIREMENTS, "# Requirements\n\nR1 — answer.\nR2 — snuck in.\n");

    const report = await ask("G1");
    expect(report.exitCode).toBe(1);
    expect(report.findings[0]?.message).toContain("has changed since G1 was sealed");
  });

  it("blocks a later gate whose predecessor broke", async () => {
    await seal("G1", REQUIREMENTS);
    await seal("G2", HLD);
    await write(REQUIREMENTS, "# Requirements\n\nrewritten\n");

    const report = await ask("G2");
    expect(report.exitCode).toBe(1);
    expect(report.findings.some((f) => f.message.includes("rests on G1"))).toBe(true);
  });

  /**
   * The reason this path exists: a PreToolUse hook runs before every intercepted tool call, and
   * parsing every artifact in the repository there is how a latency budget disappears.
   */
  it("never parses markdown", async () => {
    const loadSpy = vi.spyOn(loader, "loadRunModel");
    await seal("G1", REQUIREMENTS);

    const report = await ask("G1");

    expect(report.exitCode).toBe(0);
    expect(loadSpy).not.toHaveBeenCalled();
  });

  it("hashes only the artifacts the gates were sealed against", async () => {
    await seal("G1", REQUIREMENTS);
    // Noise the full loader would have read and hashed; the fast path must ignore it.
    await write("specs/demo/features/widget/lld.md", "# LLD\n");
    await write("specs/other/requirements.md", "# Other\n");

    const anchor = createGitAnchor(root);
    const hashSpy = vi.spyOn(anchor, "hashObjects");

    await requireGateFast({ repoRoot: root, anchor, run: "demo", gate: "G1" });

    expect(hashSpy).toHaveBeenCalledTimes(1);
    expect(hashSpy.mock.calls[0]?.[0]).toEqual([REQUIREMENTS]);
  });
});
