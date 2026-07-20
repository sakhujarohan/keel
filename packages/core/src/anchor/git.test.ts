import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createGitAnchor } from "./git.js";

const exec = promisify(execFile);

let root: string;

async function git(args: string[]): Promise<string> {
  const { stdout } = await exec("git", args, { cwd: root });
  return stdout.trim();
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "keel-git-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function initRepo(): Promise<void> {
  await git(["init", "-q", "-b", "main"]);
  await git(["config", "user.name", "Test Person"]);
  await git(["config", "user.email", "test@example.com"]);
}

async function commitAll(message: string): Promise<void> {
  await git(["add", "-A"]);
  await git(["commit", "-q", "-m", message]);
}

describe("GitAnchor", () => {
  it("recognises a repository, and its absence", async () => {
    expect(await createGitAnchor(root).isRepository()).toBe(false);
    await initRepo();
    expect(await createGitAnchor(root).isRepository()).toBe(true);
  });

  it("reads the configured identity, and reports none rather than inventing one", async () => {
    await initRepo();
    expect(await createGitAnchor(root).identity()).toBe("Test Person <test@example.com>");

    // Set it empty rather than unsetting it: unsetting would fall through to the developer's
    // global git config, which is exactly what we must not read here.
    await git(["config", "user.email", ""]);
    expect(await createGitAnchor(root).identity()).toBeNull();
  });

  it("returns null for HEAD until there is a commit", async () => {
    await initRepo();
    const anchor = createGitAnchor(root);
    expect(await anchor.headCommit()).toBeNull();

    await writeFile(join(root, "a.txt"), "hello\n");
    await commitAll("first");
    expect(await anchor.headCommit()).toMatch(/^[0-9a-f]{40}$/);
  });

  it("reports a clean tree, then the paths that dirty it", async () => {
    await initRepo();
    await writeFile(join(root, "a.txt"), "hello\n");
    await commitAll("first");

    const anchor = createGitAnchor(root);
    expect(await anchor.treeStatus()).toEqual({ clean: true, dirtyPaths: [] });

    await writeFile(join(root, "a.txt"), "changed\n");
    await writeFile(join(root, "b.txt"), "new\n");
    const dirty = await anchor.treeStatus();
    expect(dirty.clean).toBe(false);
    expect(dirty.dirtyPaths).toEqual(["a.txt", "b.txt"]);
  });

  it("returns null for a path that does not exist", async () => {
    await initRepo();
    const hashes = await createGitAnchor(root).hashObjects(["nope.txt"]);
    expect(hashes.get("nope.txt")).toBeNull();
  });

  /**
   * M1 fixes artifact_hash to the value `git hash-object` produces. We compute it natively to keep
   * a subprocess off the hook path, so this test is what holds us to the mandate: if it fails,
   * M1 is violated.
   */
  it("computes blob ids identical to `git hash-object` (mandate M1)", async () => {
    await initRepo();

    const cases: Record<string, Buffer> = {
      "empty.txt": Buffer.from(""),
      "text.md": Buffer.from("# Requirements\n\nR1 — the system shall answer.\n"),
      "unicode.md": Buffer.from("— em dash, ✓ tick, 🚦 signal\n", "utf8"),
      "crlf.txt": Buffer.from("line one\r\nline two\r\n"),
      "binary.bin": Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0x00, 0x7f]),
      "large.txt": Buffer.from("x".repeat(200_000)),
    };

    for (const [name, bytes] of Object.entries(cases)) {
      await writeFile(join(root, name), bytes);
    }

    const anchor = createGitAnchor(root);
    const ours = await anchor.hashObjects(Object.keys(cases));

    for (const name of Object.keys(cases)) {
      const theirs = await git(["hash-object", "--", name]);
      expect(ours.get(name), `blob id mismatch for ${name}`).toBe(theirs);
    }
  });

  it("hashes the working tree, not the committed content", async () => {
    await initRepo();
    await writeFile(join(root, "a.txt"), "committed\n");
    await commitAll("first");

    const anchor = createGitAnchor(root);
    const committed = (await anchor.hashObjects(["a.txt"])).get("a.txt");

    await writeFile(join(root, "a.txt"), "edited but not committed\n");
    const working = (await anchor.hashObjects(["a.txt"])).get("a.txt");

    expect(working).not.toBe(committed);
    expect(working).toBe(await git(["hash-object", "--", "a.txt"]));
  });
});
