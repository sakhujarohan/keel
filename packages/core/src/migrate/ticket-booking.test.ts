/**
 * R13's acceptance test, in the requirement's own words: `examples/ticket-booking` migrates with
 * zero manual edits and then passes `keel check` with no seal break.
 *
 * It copies the real example — not a fixture — so a change that broke migration of the shipped
 * example would fail here.
 */

import { execFile } from "node:child_process";
import { cp, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createGitAnchor } from "../anchor/git.js";
import { buildContext } from "../check/context.js";
import { runChecks } from "../check/engine.js";
import { readLedger } from "../ledger/ledger.js";
import { upgrade } from "./upgrade.js";

const exec = promisify(execFile);
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const EXAMPLE = join(REPO_ROOT, "examples", "ticket-booking");

let root: string;

async function git(args: string[]): Promise<void> {
  await exec("git", args, { cwd: root });
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "keel-tb-"));
  await git(["init", "-q", "-b", "main"]);
  await git(["config", "user.name", "Test Person"]);
  await git(["config", "user.email", "test@example.com"]);
  await cp(EXAMPLE, join(root, "specs", "ticket-booking"), { recursive: true });
  await git(["add", "-A"]);
  await git(["commit", "-q", "-m", "v1 ticket-booking"]);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("migrating the shipped ticket-booking example", () => {
  it("migrates with zero manual edits and leaves no seal broken", async () => {
    const anchor = createGitAnchor(root);
    const result = await upgrade({ repoRoot: root, anchor });

    expect(result.manifestWritten).toBe(true);
    expect(result.artifactsMigrated.length).toBeGreaterThan(0);
    expect(result.ledgerBackfilled).toBeGreaterThan(0);

    // Every backfilled entry is honestly marked, and its seal holds against the working tree.
    const ledger = await readLedger(root);
    expect(ledger.entries.every((e) => e.legacy === true)).toBe(true);
    for (const entry of ledger.entries) {
      const current = (await anchor.hashObjects([entry.artifact])).get(entry.artifact);
      expect(current, `seal for ${entry.artifact}`).toBe(entry.artifact_hash);
    }

    // The whole point: no KC-09 seal break after migration.
    const ctx = await buildContext({ repoRoot: root, anchor });
    const report = runChecks(ctx);
    expect(report.findings.filter((f) => f.rule === "KC-09")).toEqual([]);
  });

  it("touches no prose — only frontmatter schema_version changes", async () => {
    const requirementsPath = join(root, "specs/ticket-booking/requirements.md");
    const before = await readFile(requirementsPath, "utf8");

    await upgrade({ repoRoot: root, anchor: createGitAnchor(root) });

    const after = await readFile(requirementsPath, "utf8");
    // The only change is a schema_version line; strip it and the files are identical.
    const normalise = (text: string) => text.replace(/^schema_version:.*\n/m, "");
    expect(normalise(after)).toBe(normalise(before));
  });

  it("is a no-op on a second run", async () => {
    const anchor = createGitAnchor(root);
    await upgrade({ repoRoot: root, anchor });
    await git(["add", "-A"]);
    await git(["commit", "-q", "-m", "migrated"]);

    const second = await upgrade({ repoRoot: root, anchor });
    expect(second.artifactsMigrated).toEqual([]);
    expect(second.ledgerBackfilled).toBe(0);
  });

  it("actually copied a non-trivial example", async () => {
    // Guard against silently testing an empty directory.
    const entries = await readdir(join(root, "specs/ticket-booking"));
    expect(entries).toContain("requirements.md");
    expect(entries).toContain("hld.md");
  });
});
