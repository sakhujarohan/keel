import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GateEvent } from "../ledger/event.js";
import type { GateStatus } from "../ledger/seal.js";
import { splitStatus } from "../model/extract.js";
import type { RunEntry } from "../model/types.js";
import { renderNowBlock } from "./render.js";
import { deriveRunState } from "./state.js";
import { setArtifactState, writeStatus } from "./write.js";

const HASH = "9f2c41a0b1c2d3e4f5061728394a5b6c7d8e9f01";
const COMMIT = "a4ffc1900112233445566778899aabbccddeeff0";

function entry(
  gate: GateEvent["gate"],
  artifact: string,
  ts = "2026-07-21T10:00:00.000Z",
): GateEvent {
  return {
    run: "demo",
    gate,
    event: "pass",
    artifact,
    artifact_hash: HASH,
    actor: "Test Person <test@example.com>",
    commit: COMMIT,
    ts,
  };
}

function sealed(gate: GateEvent["gate"], artifact: string, ts?: string): GateStatus {
  return {
    gate,
    artifact,
    seal: { kind: "sealed", entry: entry(gate, artifact, ts) },
    blockedBy: [],
  };
}

const RUN: RunEntry = { name: "demo", dir: "specs/demo", features: [] };

describe("deriveRunState", () => {
  it("reads phase from the furthest sealed gate", () => {
    const state = deriveRunState({
      run: RUN,
      gates: [
        sealed("G1", "specs/demo/requirements.md"),
        sealed("G2", "specs/demo/hld.md"),
        sealed("G3", "specs/demo/stack.md"),
      ],
    });

    expect(state.phase).toBe(3);
    expect(state.phaseName).toBe("Stack Selection");
    expect(state.gates.map((g) => g.glyph)).toEqual(["✓", "✓", "✓", "—", "—", "—"]);
  });

  it("is phase 0 with nothing sealed", () => {
    const state = deriveRunState({ run: RUN, gates: [] });
    expect(state.phase).toBe(0);
    expect(state.gates.every((g) => g.glyph === "—")).toBe(true);
  });

  it("marks a broken seal and makes repairing it the next action", () => {
    const state = deriveRunState({
      run: RUN,
      gates: [
        {
          gate: "G1",
          artifact: "specs/demo/requirements.md",
          seal: {
            kind: "broken",
            entry: entry("G1", "specs/demo/requirements.md"),
            currentHash: "x",
          },
          blockedBy: [],
        },
      ],
    });

    expect(state.gates[0]?.glyph).toBe("⚠");
    expect(state.nextAction).toContain("no longer holds");
  });

  it("marks a gate that rests on an unsealed one", () => {
    const state = deriveRunState({
      run: RUN,
      gates: [{ ...sealed("G2", "specs/demo/hld.md"), blockedBy: ["G1"] }],
    });
    expect(state.gates[1]?.glyph).toBe("⚠");
  });

  it("carries the sealing date", () => {
    const state = deriveRunState({
      run: RUN,
      gates: [sealed("G1", "specs/demo/requirements.md", "2026-07-13T09:00:00.000Z")],
    });
    expect(state.gates[0]?.date).toBe("2026-07-13");
  });

  it("counts tasks and moves to Build & Test while they are unfinished", () => {
    const run: RunEntry = {
      ...RUN,
      features: [
        {
          name: "widget",
          declaredInHld: true,
          tasks: {
            path: "specs/demo/features/widget/tasks.md",
            type: "tasks",
            frontmatter: {
              artifact: "tasks",
              phase: 6,
              gate: "—",
              status: "draft",
              updated: "2026-07-21",
              schemaVersion: 2,
            },
            sections: [],
            tasks: [
              {
                id: "T1",
                title: "a",
                requirements: [],
                dependsOn: [],
                wave: 1,
                files: [],
                done: true,
                dod: "x",
                line: 1,
              },
              {
                id: "T2",
                title: "b",
                requirements: [],
                dependsOn: [],
                wave: 1,
                files: [],
                done: false,
                dod: "x",
                line: 2,
              },
            ],
          },
        },
      ],
    };

    const state = deriveRunState({
      run,
      gates: [
        sealed("G1", "specs/demo/requirements.md"),
        sealed("G2", "specs/demo/hld.md"),
        sealed("G3", "specs/demo/stack.md"),
        sealed("G4", "specs/demo/features/widget/lld.md"),
        sealed("G5", "specs/demo/features/widget/spec-check.md"),
      ],
    });

    expect(state.tasksDone).toBe(1);
    expect(state.tasksTotal).toBe(2);
    expect(state.phase).toBe(7);
    expect(state.nextAction).toContain("1 of 2 tasks remain");
  });
});

describe("renderNowBlock", () => {
  const state = deriveRunState({ run: RUN, gates: [sealed("G1", "specs/demo/requirements.md")] });

  it("is deterministic", () => {
    expect(renderNowBlock(state)).toBe(renderNowBlock(state));
  });

  it("produces a block the run-model can split without complaint", () => {
    const status = `${renderNowBlock(state)}\n## Session log\n\n### 2026-07-21\n- did things\n`;
    const { statusSplit, diagnostics } = splitStatus(status, "specs/demo/STATUS.md");

    expect(diagnostics).toEqual([]);
    expect(statusSplit?.nowRaw).toContain("**Phase:**");
  });
});

describe("writing without touching what we do not own", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "keel-project-"));
    await mkdir(join(root, "specs/demo"), { recursive: true });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const SESSION_LOG = `## Session log
<!-- Append-only, newest on top. -->

### 2026-07-13 — first session
- **Did:** something worth remembering
- **Next:** the next thing

`;

  it("leaves the session log byte-identical", async () => {
    await writeFile(
      join(root, "specs/demo/STATUS.md"),
      `# Old heading\n\n## Now\n\n- stale\n\n${SESSION_LOG}`,
    );

    const state = deriveRunState({ run: RUN, gates: [sealed("G1", "specs/demo/requirements.md")] });
    const result = await writeStatus({ repoRoot: root, run: RUN, state });

    const after = await readFile(join(root, "specs/demo/STATUS.md"), "utf8");
    expect(result.changed).toBe(true);
    expect(after.slice(after.indexOf("## Session log"))).toBe(SESSION_LOG);
    expect(after).toContain("**Phase:** 1 / 8");
  });

  it("refuses rather than risking a status file with no session log", async () => {
    await writeFile(join(root, "specs/demo/STATUS.md"), "# Run Status\n\n## Now\n\n- stale\n");
    const state = deriveRunState({ run: RUN, gates: [] });

    await expect(writeStatus({ repoRoot: root, run: RUN, state })).rejects.toMatchObject({
      code: "ENV_UNREADABLE",
    });
  });

  it("writes nothing when the projection already matches", async () => {
    const state = deriveRunState({ run: RUN, gates: [sealed("G1", "specs/demo/requirements.md")] });
    await writeFile(join(root, "specs/demo/STATUS.md"), `${renderNowBlock(state)}\n${SESSION_LOG}`);

    const before = await readFile(join(root, "specs/demo/STATUS.md"), "utf8");
    const result = await writeStatus({ repoRoot: root, run: RUN, state });
    const after = await readFile(join(root, "specs/demo/STATUS.md"), "utf8");

    expect(result.changed).toBe(false);
    expect(after).toBe(before);
  });

  it("changes two frontmatter values and nothing else", async () => {
    const original = `---
artifact: requirements
phase: 1
gate: G1
status: draft        # draft | signed-off
updated: 2026-06-01
schema_version: 2
owner: rohan
---

# Requirements — demo

Body text with a --- inside it, and a status: word in prose.
`;
    await writeFile(join(root, "specs/demo/requirements.md"), original);

    const result = await setArtifactState({
      repoRoot: root,
      path: "specs/demo/requirements.md",
      status: "signed-off",
      updated: "2026-07-21",
    });

    const after = await readFile(join(root, "specs/demo/requirements.md"), "utf8");
    expect(result.changed).toBe(true);
    expect(after).toContain("status: signed-off");
    expect(after).toContain("updated: 2026-07-21");
    // Everything else survives: comments, extra keys, and prose that merely looks like frontmatter.
    expect(after).toContain("owner: rohan");
    expect(after).toContain("artifact: requirements");
    expect(after).toContain("Body text with a --- inside it, and a status: word in prose.");
    expect(after.split("\n").length).toBe(original.split("\n").length);
  });

  it("refuses to insert a key that is missing, because inserting is authoring", async () => {
    await writeFile(
      join(root, "specs/demo/requirements.md"),
      "---\nartifact: requirements\nphase: 1\n---\n\n# Requirements\n",
    );

    await expect(
      setArtifactState({
        repoRoot: root,
        path: "specs/demo/requirements.md",
        status: "signed-off",
        updated: "2026-07-21",
      }),
    ).rejects.toMatchObject({ code: "ENV_UNREADABLE" });
  });

  it("refuses a file with no frontmatter", async () => {
    await writeFile(join(root, "specs/demo/notes.md"), "# Just notes\n");

    await expect(
      setArtifactState({
        repoRoot: root,
        path: "specs/demo/notes.md",
        status: "draft",
        updated: "2026-07-21",
      }),
    ).rejects.toMatchObject({ code: "ENV_UNREADABLE" });
  });
});
