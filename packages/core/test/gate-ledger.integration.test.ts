/**
 * The whole gate story, on a real git repository.
 *
 * Seal a gate, break it by editing the sealed file, watch the downstream gates fall, reopen,
 * re-seal — and prove at the end that not one earlier line of the ledger was ever rewritten.
 */

import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createGitAnchor } from "../src/anchor/git.js";
import { commitSeal, prepareSeal, reopenGate } from "../src/gate/operations.js";
import { LEDGER_PATH } from "../src/ledger/event.js";
import { readLedger } from "../src/ledger/ledger.js";
import { gateStatuses } from "../src/ledger/seal.js";

const exec = promisify(execFile);

const REQUIREMENTS = "specs/demo/requirements.md";
const HLD = "specs/demo/hld.md";

let root: string;

async function git(args: string[]): Promise<string> {
  const { stdout } = await exec("git", args, { cwd: root });
  return stdout.trim();
}

async function write(path: string, contents: string): Promise<void> {
  await mkdir(join(root, path, ".."), { recursive: true });
  await writeFile(join(root, path), contents, "utf8");
}

async function commitAll(message: string): Promise<void> {
  await git(["add", "-A"]);
  await git(["commit", "-q", "-m", message]);
}

async function currentHashes(paths: string[]): Promise<Map<string, string | null>> {
  return createGitAnchor(root).hashObjects(paths);
}

function gateArgs(gate: "G1" | "G2", artifact: string, iso: string) {
  return {
    repoRoot: root,
    anchor: createGitAnchor(root),
    run: "demo",
    gate,
    artifact,
    now: () => new Date(iso),
  };
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "keel-e2e-"));
  await git(["init", "-q", "-b", "main"]);
  await git(["config", "user.name", "Test Person"]);
  await git(["config", "user.email", "test@example.com"]);
  await write(REQUIREMENTS, "# Requirements\n\nR1 — the system shall answer.\n");
  await write(HLD, "# High-Level Design\n");
  await commitAll("seed the run");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("sealing, breaking, reopening", () => {
  it("walks the full lifecycle and never rewrites history", async () => {
    // 1. Seal G1 and G2.
    await commitSeal({
      repoRoot: root,
      prepared: await prepareSeal(gateArgs("G1", REQUIREMENTS, "2026-07-20T10:00:00.000Z")),
    });
    await commitSeal({
      repoRoot: root,
      prepared: await prepareSeal(gateArgs("G2", HLD, "2026-07-20T10:05:00.000Z")),
    });

    let statuses = gateStatuses({
      run: "demo",
      view: await readLedger(root),
      hashes: await currentHashes([REQUIREMENTS, HLD]),
    });
    expect(statuses.map((s) => [s.gate, s.seal.kind, s.blockedBy])).toEqual([
      ["G1", "sealed", []],
      ["G2", "sealed", []],
    ]);

    const afterSealing = await readFile(join(root, LEDGER_PATH), "utf8");

    // 2. Someone edits the sealed requirements. G1 breaks, and G2 falls with it.
    await write(REQUIREMENTS, "# Requirements\n\nR1 — the system shall answer.\nR2 — snuck in.\n");

    statuses = gateStatuses({
      run: "demo",
      view: await readLedger(root),
      hashes: await currentHashes([REQUIREMENTS, HLD]),
    });
    expect(statuses.find((s) => s.gate === "G1")?.seal.kind).toBe("broken");
    expect(statuses.find((s) => s.gate === "G2")?.blockedBy).toEqual(["G1"]);

    // 3. Putting the exact bytes back heals everything, with no cleanup step.
    await write(REQUIREMENTS, "# Requirements\n\nR1 — the system shall answer.\n");
    statuses = gateStatuses({
      run: "demo",
      view: await readLedger(root),
      hashes: await currentHashes([REQUIREMENTS, HLD]),
    });
    expect(statuses.every((s) => s.seal.kind === "sealed")).toBe(true);

    // 4. The change was real after all: reopen, amend, re-seal.
    await write(REQUIREMENTS, "# Requirements\n\nR1 — the system shall answer.\nR2 — confirmed.\n");
    await reopenGate(gateArgs("G1", REQUIREMENTS, "2026-07-20T11:00:00.000Z"));

    statuses = gateStatuses({
      run: "demo",
      view: await readLedger(root),
      hashes: await currentHashes([REQUIREMENTS, HLD]),
    });
    expect(statuses.find((s) => s.gate === "G1")?.seal.kind).toBe("reopened");
    expect(statuses.find((s) => s.gate === "G2")?.blockedBy).toEqual(["G1"]);

    await commitAll("amend requirements");
    await commitSeal({
      repoRoot: root,
      prepared: await prepareSeal(gateArgs("G1", REQUIREMENTS, "2026-07-20T11:05:00.000Z")),
    });

    statuses = gateStatuses({
      run: "demo",
      view: await readLedger(root),
      hashes: await currentHashes([REQUIREMENTS, HLD]),
    });
    expect(statuses.find((s) => s.gate === "G1")?.seal.kind).toBe("sealed");

    // 5. The ledger only ever grew.
    const finalLedger = await readFile(join(root, LEDGER_PATH), "utf8");
    expect(finalLedger.startsWith(afterSealing)).toBe(true);

    const view = await readLedger(root);
    expect(view.diagnostics).toEqual([]);
    expect(
      view.historyFor({ run: "demo", gate: "G1", artifact: REQUIREMENTS }).map((e) => e.event),
    ).toEqual(["pass", "reopen", "pass"]);
  });

  it("keeps a sealed gate sealed across a commit that does not touch the artifact", async () => {
    await commitSeal({
      repoRoot: root,
      prepared: await prepareSeal(gateArgs("G1", REQUIREMENTS, "2026-07-20T10:00:00.000Z")),
    });

    await write("src/unrelated.ts", "export const x = 1;\n");
    await commitAll("unrelated work");

    const statuses = gateStatuses({
      run: "demo",
      view: await readLedger(root),
      hashes: await currentHashes([REQUIREMENTS]),
    });
    // The seal follows content, not commits.
    expect(statuses[0]?.seal.kind).toBe("sealed");
  });

  it("survives a hand-mangled ledger line without losing the other seals", async () => {
    await commitSeal({
      repoRoot: root,
      prepared: await prepareSeal(gateArgs("G1", REQUIREMENTS, "2026-07-20T10:00:00.000Z")),
    });
    await commitSeal({
      repoRoot: root,
      prepared: await prepareSeal(gateArgs("G2", HLD, "2026-07-20T10:05:00.000Z")),
    });

    const raw = await readFile(join(root, LEDGER_PATH), "utf8");
    const lines = raw.trim().split("\n");
    await writeFile(join(root, LEDGER_PATH), `${lines[0]}\n{ mangled\n${lines[1]}\n`, "utf8");

    const view = await readLedger(root);
    expect(view.entries).toHaveLength(2);
    expect(view.diagnostics.map((d) => d.code)).toEqual(["ledger-line-malformed"]);

    const statuses = gateStatuses({
      run: "demo",
      view,
      hashes: await currentHashes([REQUIREMENTS, HLD]),
    });
    expect(statuses.every((s) => s.seal.kind === "sealed")).toBe(true);
  });
});
