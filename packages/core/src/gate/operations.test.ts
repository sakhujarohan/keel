import { execFile } from "node:child_process";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createGitAnchor } from "../anchor/git.js";
import { LEDGER_PATH } from "../ledger/event.js";
import { readLedger } from "../ledger/ledger.js";
import { commitSeal, prepareSeal, reopenGate } from "./operations.js";
import { GateRefusal } from "./refusal.js";

const exec = promisify(execFile);

let root: string;
const ARTIFACT = "specs/demo/requirements.md";
const at = (iso: string) => () => new Date(iso);

async function git(args: string[]): Promise<string> {
  const { stdout } = await exec("git", args, { cwd: root });
  return stdout.trim();
}

async function seedRepo({ identity = true }: { identity?: boolean } = {}): Promise<void> {
  await git(["init", "-q", "-b", "main"]);
  if (identity) {
    await git(["config", "user.name", "Test Person"]);
    await git(["config", "user.email", "test@example.com"]);
  }
  await writeFile(join(root, "README.md"), "# demo\n");
  await git(["add", "-A"]);
  if (identity) await git(["commit", "-q", "-m", "first"]);
}

async function writeArtifact(contents: string): Promise<void> {
  await exec("mkdir", ["-p", join(root, "specs/demo")]);
  await writeFile(join(root, ARTIFACT), contents);
}

async function commitAll(message: string): Promise<void> {
  await git(["add", "-A"]);
  await git(["commit", "-q", "-m", message]);
}

async function ledgerExists(): Promise<boolean> {
  return access(join(root, LEDGER_PATH)).then(
    () => true,
    () => false,
  );
}

function seal(overrides: Record<string, unknown> = {}) {
  return {
    repoRoot: root,
    anchor: createGitAnchor(root),
    run: "demo",
    gate: "G1" as const,
    artifact: ARTIFACT,
    now: at("2026-07-20T10:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "keel-gate-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("prepareSeal", () => {
  it("builds a complete entry without writing anything", async () => {
    await seedRepo();
    await writeArtifact("# Requirements\n");
    await commitAll("add requirements");

    const prepared = await prepareSeal(seal());

    expect(prepared.entry).toMatchObject({
      run: "demo",
      gate: "G1",
      event: "pass",
      artifact: ARTIFACT,
      actor: "Test Person <test@example.com>",
      ts: "2026-07-20T10:00:00.000Z",
    });
    expect(prepared.entry.artifact_hash).toBe(await git(["hash-object", "--", ARTIFACT]));
    expect(prepared.entry.commit).toBe(await git(["rev-parse", "HEAD"]));
    expect(prepared.entry.dirty).toBeUndefined();
    // The whole point of splitting prepare from commit:
    expect(await ledgerExists()).toBe(false);
  });

  it("refuses a dirty tree, naming the paths, and writes nothing", async () => {
    await seedRepo();
    await writeArtifact("# Requirements\n");
    await commitAll("add requirements");
    await writeFile(join(root, "README.md"), "# demo, edited\n");

    const error = await prepareSeal(seal()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GateRefusal);
    expect(error).toMatchObject({ reason: "dirty-tree", dirtyPaths: ["README.md"] });
    expect((error as GateRefusal).nextAction).toContain("--allow-dirty");
    expect(await ledgerExists()).toBe(false);
  });

  it("does not count its own ledger as dirt — otherwise no second gate could ever be sealed", async () => {
    await seedRepo();
    await writeArtifact("# Requirements\n");
    await writeFile(join(root, "specs/demo/hld.md"), "# High-Level Design\n");
    await commitAll("add requirements and hld");

    // Sealing G1 writes .keel/gates.jsonl, leaving it uncommitted.
    await commitSeal({ repoRoot: root, prepared: await prepareSeal(seal()) });
    expect((await createGitAnchor(root).treeStatus()).clean).toBe(false);

    const second = await prepareSeal(seal({ gate: "G2", artifact: "specs/demo/hld.md" }));
    expect(second.entry.dirty).toBeUndefined();
    expect(second.dirtyPaths).toEqual([]);
  });

  it("stamps dirty: true when the tree is dirty and that was allowed", async () => {
    await seedRepo();
    await writeArtifact("# Requirements\n");
    await commitAll("add requirements");
    await writeFile(join(root, "README.md"), "# demo, edited\n");

    const prepared = await prepareSeal(seal({ allowDirty: true }));
    expect(prepared.entry.dirty).toBe(true);
    expect(prepared.dirtyPaths).toEqual(["README.md"]);
  });

  it("refuses in a repository with no commits", async () => {
    await git(["init", "-q", "-b", "main"]);
    await git(["config", "user.name", "Test Person"]);
    await git(["config", "user.email", "test@example.com"]);
    await writeArtifact("# Requirements\n");

    await expect(prepareSeal(seal())).rejects.toMatchObject({ reason: "no-commit" });
    expect(await ledgerExists()).toBe(false);
  });

  it("refuses outside a git repository", async () => {
    await writeArtifact("# Requirements\n");
    await expect(prepareSeal(seal())).rejects.toMatchObject({ reason: "not-a-repository" });
  });

  it("refuses when git has no identity, rather than inventing an actor", async () => {
    await seedRepo();
    await writeArtifact("# Requirements\n");
    await commitAll("add requirements");
    await git(["config", "user.email", ""]); // empty, not unset — unset falls back to global config

    const error = await prepareSeal(seal()).catch((e: unknown) => e);
    expect(error).toMatchObject({ reason: "no-identity" });
    expect((error as GateRefusal).nextAction).toContain("git config user.email");
    expect(await ledgerExists()).toBe(false);
  });

  it("refuses when the artifact does not exist", async () => {
    await seedRepo();
    await expect(prepareSeal(seal())).rejects.toMatchObject({ reason: "artifact-missing" });
  });

  it("refuses to re-seal byte-identical content", async () => {
    await seedRepo();
    await writeArtifact("# Requirements\n");
    await commitAll("add requirements");

    await commitSeal({ repoRoot: root, prepared: await prepareSeal(seal()) });

    const error = await prepareSeal(seal()).catch((e: unknown) => e);
    expect(error).toMatchObject({ reason: "already-sealed" });
    expect((await readLedger(root)).entries).toHaveLength(1);
  });

  it("seals again once the content actually changes", async () => {
    await seedRepo();
    await writeArtifact("# Requirements\n");
    await commitAll("add requirements");
    await commitSeal({ repoRoot: root, prepared: await prepareSeal(seal()) });

    await writeArtifact("# Requirements\n\nR1 — a new one.\n");
    await commitAll("amend requirements");

    const second = await prepareSeal(seal({ now: at("2026-07-20T11:00:00.000Z") }));
    expect(second.priorEvent?.event).toBe("pass");
    expect(second.entry.artifact_hash).not.toBe(second.priorEvent?.artifact_hash);
  });
});

describe("commitSeal and reopenGate", () => {
  it("writes exactly the prepared entry", async () => {
    await seedRepo();
    await writeArtifact("# Requirements\n");
    await commitAll("add requirements");

    const prepared = await prepareSeal(seal());
    const written = await commitSeal({ repoRoot: root, prepared });

    const view = await readLedger(root);
    expect(view.entries).toEqual([written]);
    expect(view.entries[0]).toEqual(prepared.entry);
  });

  it("records a reopen without erasing the pass before it", async () => {
    await seedRepo();
    await writeArtifact("# Requirements\n");
    await commitAll("add requirements");
    await commitSeal({ repoRoot: root, prepared: await prepareSeal(seal()) });

    await reopenGate(seal({ now: at("2026-07-20T12:00:00.000Z") }));

    const view = await readLedger(root);
    const history = view.historyFor({ run: "demo", gate: "G1", artifact: ARTIFACT });
    expect(history.map((e) => e.event)).toEqual(["pass", "reopen"]);
  });

  it("does not require a clean tree to reopen — reopening is not a sign-off", async () => {
    await seedRepo();
    await writeArtifact("# Requirements\n");
    await commitAll("add requirements");
    await writeFile(join(root, "README.md"), "# dirty\n");

    await expect(reopenGate(seal())).resolves.toMatchObject({ event: "reopen" });
  });
});
