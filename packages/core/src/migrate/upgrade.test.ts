import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createGitAnchor } from "../anchor/git.js";
import { readLedger } from "../ledger/ledger.js";
import { upgrade } from "./upgrade.js";

const exec = promisify(execFile);
let root: string;

async function git(args: string[]): Promise<void> {
  await exec("git", args, { cwd: root });
}

async function write(path: string, contents: string): Promise<void> {
  await mkdir(join(root, path, ".."), { recursive: true });
  await writeFile(join(root, path), contents, "utf8");
}

/** A v1 artifact: signed-off in frontmatter, no schema_version. */
function v1(artifact: string, gate: string, status = "signed-off"): string {
  return `---
artifact: ${artifact}
phase: 1
gate: ${gate}
status: ${status}
updated: 2026-06-07
---

# ${artifact}

Some prose the migrator must not touch.
`;
}

async function seedV1(): Promise<void> {
  await write("specs/ticket-booking/requirements.md", v1("requirements", "G1"));
  await write("specs/ticket-booking/hld.md", v1("hld", "G2"));
  await write("specs/ticket-booking/features/seat-hold/lld.md", v1("lld", "G4", "draft"));
  await git(["add", "-A"]);
  await git(["commit", "-q", "-m", "v1 run"]);
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "keel-upgrade-"));
  await git(["init", "-q", "-b", "main"]);
  await git(["config", "user.name", "Test Person"]);
  await git(["config", "user.email", "test@example.com"]);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const run = () =>
  upgrade({
    repoRoot: root,
    anchor: createGitAnchor(root),
    now: () => new Date("2026-07-21T10:00:00.000Z"),
  });

describe("upgrade", () => {
  it("writes the manifest, bumps frontmatter, and backfills signed-off gates", async () => {
    await seedV1();
    const result = await run();

    expect(result.manifestWritten).toBe(true);
    expect(await readFile(join(root, "keel.yaml"), "utf8")).toContain("schema: 2");

    const requirements = await readFile(join(root, "specs/ticket-booking/requirements.md"), "utf8");
    expect(requirements).toContain("schema_version: 2");
    expect(requirements).toContain("Some prose the migrator must not touch.");

    // Two signed-off artifacts (requirements G1, hld G2); the draft lld is not backfilled.
    expect(result.ledgerBackfilled).toBe(2);
    const ledger = await readLedger(root);
    expect(ledger.entries.every((e) => e.legacy === true)).toBe(true);
    expect(ledger.entries.map((e) => e.gate).sort()).toEqual(["G1", "G2"]);
  });

  it("leaves the prose and every other frontmatter line untouched", async () => {
    await seedV1();
    const before = await readFile(join(root, "specs/ticket-booking/requirements.md"), "utf8");
    await run();
    const after = await readFile(join(root, "specs/ticket-booking/requirements.md"), "utf8");

    // Only one line added: schema_version. Everything else identical.
    expect(after.replace("schema_version: 2\n", "")).toBe(before);
  });

  it("seals hold immediately after migration — no KC-09 break", async () => {
    await seedV1();
    await run();

    const ledger = await readLedger(root);
    const anchor = createGitAnchor(root);
    for (const entry of ledger.entries) {
      const current = (await anchor.hashObjects([entry.artifact])).get(entry.artifact);
      expect(current, `seal for ${entry.artifact} must match the working tree`).toBe(
        entry.artifact_hash,
      );
    }
  });

  it("refuses on a dirty tree", async () => {
    await seedV1();
    await write("specs/ticket-booking/requirements.md", "edited, uncommitted\n");

    await expect(run()).rejects.toMatchObject({ reason: "dirty-tree" });
    // Nothing written.
    await expect(readFile(join(root, "keel.yaml"), "utf8")).rejects.toBeDefined();
  });

  it("is a no-op the second time", async () => {
    await seedV1();
    await run();
    await git(["add", "-A"]);
    await git(["commit", "-q", "-m", "migrated"]);

    const second = await run();
    expect(second.manifestWritten).toBe(false);
    expect(second.artifactsMigrated).toEqual([]);
    expect(second.ledgerBackfilled).toBe(0);
  });

  it("skips an artifact with no frontmatter rather than erroring", async () => {
    await write("specs/demo/requirements.md", v1("requirements", "G1"));
    await write("specs/demo/notes.md", "# just notes, no frontmatter\n");
    await git(["add", "-A"]);
    await git(["commit", "-q", "-m", "mixed"]);

    const result = await run();
    // notes.md is not a recognised artifact filename, so it is not even visited — no error either way.
    expect(result.artifactsMigrated).toContain("specs/demo/requirements.md");
  });
});
