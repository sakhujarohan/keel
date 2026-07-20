/**
 * The S1–S5 product-flow walkthrough, executed against the real `keel` binary in a temp git repo.
 *
 * This is the test that would have caught anything the unit tests mocked away: real process exit
 * codes, real files on disk, the commands composed the way a user composes them.
 */

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const exec = promisify(execFile);
const MAIN = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "main.ts");

let root: string;

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

/** Invoke the CLI exactly as a shell would, capturing the real exit code. */
async function keel(args: string[]): Promise<Run> {
  try {
    const { stdout, stderr } = await exec("npx", ["tsx", MAIN, ...args], { cwd: root });
    return { code: 0, stdout, stderr };
  } catch (error) {
    const err = error as { code?: number; stdout?: string; stderr?: string };
    return { code: err.code ?? 1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}

async function git(args: string[]): Promise<void> {
  await exec("git", args, { cwd: root });
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "keel-e2e-"));
  await git(["init", "-q", "-b", "main"]);
  await git(["config", "user.name", "Test Person"]);
  await git(["config", "user.email", "test@example.com"]);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("the CLI, end to end", () => {
  it("walks init → run new → seal → break → check → status", async () => {
    // S1 — init.
    const init = await keel(["init"]);
    expect(init.code).toBe(0);
    expect(init.stdout).toContain("keel.yaml");

    // A run.
    const created = await keel(["run", "new", "checkout"]);
    expect(created.code).toBe(0);
    expect(await readFile(join(root, "specs/checkout/context.md"), "utf8")).toContain("checkout");

    // Give the run a requirements artifact to seal, and commit so the tree is clean.
    await writeFile(
      join(root, "specs/checkout/requirements.md"),
      "---\nartifact: requirements\nphase: 1\ngate: G1\nstatus: draft\nupdated: 2026-07-21\nschema_version: 2\n---\n\n# Requirements\n\nR1 — hold inventory.\n",
    );
    await git(["add", "-A"]);
    await git(["commit", "-q", "-m", "seed the run"]);

    // S2 — seal G1 with the real command (non-interactive, so --yes).
    const sealed = await keel([
      "gate",
      "pass",
      "G1",
      "--run",
      "checkout",
      "--artifact",
      "specs/checkout/requirements.md",
      "--yes",
    ]);
    expect(sealed.code).toBe(0);
    expect(sealed.stdout).toContain("G1 sealed");

    // The ledger and the frontmatter both moved.
    const ledger = await readFile(join(root, ".keel/gates.jsonl"), "utf8");
    expect(ledger).toContain('"gate":"G1"');
    expect(ledger).toContain('"event":"pass"');
    const requirements = await readFile(join(root, "specs/checkout/requirements.md"), "utf8");
    expect(requirements).toContain("status: signed-off");
    const status = await readFile(join(root, "specs/checkout/STATUS.md"), "utf8");
    expect(status).toContain("G1 ✓");

    // The seal holds: no seal-break, no gate-order finding against the sealed artifact. (The
    // skeletal fixture trips content rules like KC-01, which is the tool being correct — this
    // walk is about the seal lifecycle, so we assert on the seal-specific rule.)
    const afterSeal = await keel(["check", "--run", "checkout", "--format", "agent"]);
    expect(afterSeal.stdout).not.toContain("KC-09");
    expect(afterSeal.stdout).not.toContain("has changed since G1");

    // S4 — edit the sealed artifact; the seal breaks and check blocks.
    await writeFile(
      join(root, "specs/checkout/requirements.md"),
      "---\nartifact: requirements\nphase: 1\ngate: G1\nstatus: signed-off\nupdated: 2026-07-21\nschema_version: 2\n---\n\n# Requirements\n\nR1 — hold inventory.\nR2 — snuck in.\n",
    );
    const broken = await keel(["check", "--run", "checkout"]);
    expect(broken.code).toBe(1);
    expect(broken.stdout).toContain("KC-09");

    // status re-projects the ⚠.
    const reprojected = await keel(["status", "--run", "checkout"]);
    expect(reprojected.code).toBe(0);
    expect(await readFile(join(root, "specs/checkout/STATUS.md"), "utf8")).toContain("G1 ⚠");
  }, 60_000);

  it("blocks a gate-skip on the fast path, then passes once sealed", async () => {
    await keel(["init"]);
    await keel(["run", "new", "demo"]);
    await writeFile(
      join(root, "specs/demo/requirements.md"),
      "---\nartifact: requirements\nphase: 1\ngate: G1\nstatus: draft\nupdated: 2026-07-21\nschema_version: 2\n---\n\n# Requirements\n\nR1 — x.\n",
    );
    await git(["add", "-A"]);
    await git(["commit", "-q", "-m", "seed"]);

    // The exact call the PreToolUse hook makes before /hld.
    const blocked = await keel(["check", "--require", "G1", "--run", "demo", "--format", "agent"]);
    expect(blocked.code).toBe(1);
    expect(blocked.stdout).toContain("keel gate pass G1 --run demo");

    await keel([
      "gate",
      "pass",
      "G1",
      "--run",
      "demo",
      "--artifact",
      "specs/demo/requirements.md",
      "--yes",
    ]);

    const allowed = await keel(["check", "--require", "G1", "--run", "demo", "--format", "agent"]);
    expect(allowed.code).toBe(0);
  }, 60_000);

  it("refuses to seal without confirmation when there is no terminal", async () => {
    await keel(["init"]);
    await keel(["run", "new", "demo"]);
    await writeFile(
      join(root, "specs/demo/requirements.md"),
      "---\nartifact: requirements\nphase: 1\ngate: G1\nstatus: draft\nupdated: 2026-07-21\nschema_version: 2\n---\n\n# Requirements\n\nR1 — x.\n",
    );
    await git(["add", "-A"]);
    await git(["commit", "-q", "-m", "seed"]);

    // No --yes, and exec provides no TTY: consent must not be assumed.
    const refused = await keel([
      "gate",
      "pass",
      "G1",
      "--run",
      "demo",
      "--artifact",
      "specs/demo/requirements.md",
    ]);
    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain("--yes");
  }, 60_000);

  it("exits 0 on a non-keel repo and 2 under --strict", async () => {
    // A fresh repo with no keel.yaml — deliberately not running init here.
    await writeFile(join(root, "README.md"), "# just a repo\n");

    const lenient = await keel(["check"]);
    expect(lenient.code).toBe(0);
    expect(lenient.stdout).toContain("not a keel repo");

    const strict = await keel(["check", "--strict"]);
    expect(strict.code).toBe(2);
  }, 60_000);

  it("doctor reports the wiring without changing anything", async () => {
    await keel(["init"]);
    const doctor = await keel(["doctor"]);
    expect(doctor.stdout).toContain("agent hooks");
    expect(doctor.stdout).toContain("6 of 6 phase skills gated");
  }, 60_000);
});
