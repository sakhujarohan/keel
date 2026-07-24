/**
 * The commit hook's mandate: attribution trailers that omit what they cannot know (M5).
 *
 * The hook is a shell script `init` installs, so the honest test runs it as git would — a real
 * repo, a real commit, with and without the KEEL_* environment.
 */

import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { init } from "./init.js";

const exec = promisify(execFile);
let root: string;

async function git(args: string[], env?: Record<string, string>): Promise<void> {
  await exec("git", args, { cwd: root, env: { ...process.env, ...env } });
}

async function lastMessage(): Promise<string> {
  const { stdout } = await exec("git", ["log", "-1", "--format=%B"], { cwd: root });
  return stdout;
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "keel-hook-"));
  await git(["init", "-q", "-b", "main"]);
  await git(["config", "user.name", "Test Person"]);
  await git(["config", "user.email", "test@example.com"]);
  await init({ repoRoot: root });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("the attribution hook", () => {
  it("adds trailers from the environment", async () => {
    await writeFile(join(root, "a.txt"), "one\n");
    await git(["add", "-A"]);
    await git(["commit", "-q", "-m", "work"], {
      KEEL_RUN: "keel-v2",
      KEEL_TASK: "T1",
      KEEL_AGENT_TOOL: "claude-code",
      KEEL_AGENT_MODEL: "claude-opus-4-8",
      KEEL_AGENT_SESSION: "abc-123",
    });

    const message = await lastMessage();
    expect(message).toContain("Keel-Run: keel-v2");
    expect(message).toContain("Agent-Model: claude-opus-4-8");
    expect(message).toContain("Agent-Session: abc-123");
  });

  it("omits a value the environment does not supply — never inventing one", async () => {
    await writeFile(join(root, "b.txt"), "two\n");
    await git(["add", "-A"]);
    await git(["commit", "-q", "-m", "partial"], {
      KEEL_AGENT_MODEL: "claude-opus-4-8",
      // no session, no run, no task, no tool
    });

    const message = await lastMessage();
    expect(message).toContain("Agent-Model: claude-opus-4-8");
    expect(message).not.toContain("Agent-Session:");
    expect(message).not.toContain("Keel-Run:");
  });

  it("adds no trailer block at all for a human commit", async () => {
    await writeFile(join(root, "c.txt"), "three\n");
    await git(["add", "-A"]);
    await git(["commit", "-q", "-m", "human work"]);

    const message = await lastMessage();
    expect(message).not.toContain("Agent-");
    expect(message).not.toContain("Keel-");
    expect(message.trim()).toBe("human work");
  });

  it("does not duplicate a trailer that is already present", async () => {
    await writeFile(join(root, "d.txt"), "four\n");
    await git(["add", "-A"]);
    await git(["commit", "-q", "-m", "work\n\nAgent-Model: hand-written"], {
      KEEL_AGENT_MODEL: "claude-opus-4-8",
    });

    const message = await lastMessage();
    expect(message.match(/Agent-Model:/g)?.length).toBe(1);
    expect(message).toContain("Agent-Model: hand-written");
  });
});
