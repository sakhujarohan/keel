import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type GateEvent, LEDGER_PATH, serialiseGateEvent } from "./event.js";
import { appendGateEvent, readLedger, type SealKey } from "./ledger.js";

const HASH = "9f2c41a0b1c2d3e4f5061728394a5b6c7d8e9f01";
const HASH2 = "41d0c77aabbccddeeff00112233445566778899a";
const COMMIT = "a4ffc1900112233445566778899aabbccddeeff0";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "keel-ledger-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function event(overrides: Partial<GateEvent> = {}): GateEvent {
  return {
    run: "demo",
    gate: "G1",
    event: "pass",
    artifact: "specs/demo/requirements.md",
    artifact_hash: HASH,
    actor: "Test Person <test@example.com>",
    commit: COMMIT,
    ts: "2026-07-20T10:00:00.000Z",
    ...overrides,
  };
}

async function seedLedger(lines: string[]): Promise<void> {
  await mkdir(join(root, ".keel"), { recursive: true });
  await writeFile(join(root, LEDGER_PATH), `${lines.join("\n")}\n`, "utf8");
}

const KEY: SealKey = { run: "demo", gate: "G1", artifact: "specs/demo/requirements.md" };

describe("readLedger", () => {
  it("returns an empty view when no ledger exists — that is not an error", async () => {
    const view = await readLedger(root);
    expect(view.entries).toEqual([]);
    expect(view.diagnostics).toEqual([]);
    expect(view.latestFor(KEY)).toBeUndefined();
  });

  it("keeps entries in file order", async () => {
    await seedLedger([
      serialiseGateEvent(event({ ts: "2026-07-20T12:00:00.000Z" })),
      serialiseGateEvent(event({ gate: "G2", artifact: "specs/demo/hld.md" })),
    ]);

    const view = await readLedger(root);
    expect(view.entries.map((e) => e.gate)).toEqual(["G1", "G2"]);
  });

  it("orders by position, not by timestamp — a skewed clock cannot rewrite history", async () => {
    await seedLedger([
      serialiseGateEvent(event({ ts: "2026-07-20T23:00:00.000Z" })),
      serialiseGateEvent(event({ event: "reopen", ts: "2026-07-20T01:00:00.000Z" })),
    ]);

    const view = await readLedger(root);
    expect(view.latestFor(KEY)?.event).toBe("reopen");
  });

  it("diagnoses one unusable line and keeps the rest", async () => {
    await seedLedger([
      serialiseGateEvent(event()),
      "{ this is not json",
      serialiseGateEvent(event({ gate: "G2", artifact: "specs/demo/hld.md" })),
    ]);

    const view = await readLedger(root);
    expect(view.entries).toHaveLength(2);
    expect(view.diagnostics).toHaveLength(1);
    expect(view.diagnostics[0]).toMatchObject({ code: "ledger-line-malformed", line: 2 });
  });

  it("diagnoses an entry that breaks the closed field set", async () => {
    await seedLedger([JSON.stringify({ ...event(), feature: "run-model" })]);

    const view = await readLedger(root);
    expect(view.entries).toEqual([]);
    expect(view.diagnostics[0]?.code).toBe("ledger-entry-invalid");
  });

  it("answers latestFor and historyFor per key", async () => {
    await seedLedger([
      serialiseGateEvent(event()),
      serialiseGateEvent(event({ event: "reopen", ts: "2026-07-20T11:00:00.000Z" })),
      serialiseGateEvent(event({ artifact_hash: HASH2, ts: "2026-07-20T12:00:00.000Z" })),
    ]);

    const view = await readLedger(root);
    expect(view.historyFor(KEY).map((e) => e.event)).toEqual(["pass", "reopen", "pass"]);
    expect(view.latestFor(KEY)?.artifact_hash).toBe(HASH2);
  });

  it("lists the distinct keys of a run", async () => {
    await seedLedger([
      serialiseGateEvent(event()),
      serialiseGateEvent(event({ event: "reopen" })),
      serialiseGateEvent(event({ gate: "G2", artifact: "specs/demo/hld.md" })),
      serialiseGateEvent(
        event({ run: "other", gate: "G1", artifact: "specs/other/requirements.md" }),
      ),
    ]);

    const view = await readLedger(root);
    expect(view.keysFor("demo").map((k) => k.gate)).toEqual(["G1", "G2"]);
    expect(view.keysFor("other")).toHaveLength(1);
  });
});

describe("appendGateEvent", () => {
  it("creates .keel/ and writes one newline-terminated line", async () => {
    await appendGateEvent(root, event());

    const raw = await readFile(join(root, LEDGER_PATH), "utf8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(raw.trim().split("\n")).toHaveLength(1);
  });

  it("appends without disturbing what came before", async () => {
    await appendGateEvent(root, event());
    const first = await readFile(join(root, LEDGER_PATH), "utf8");

    await appendGateEvent(root, event({ gate: "G2", artifact: "specs/demo/hld.md" }));
    const second = await readFile(join(root, LEDGER_PATH), "utf8");

    expect(second.startsWith(first)).toBe(true);
    expect(second.trim().split("\n")).toHaveLength(2);
  });

  it("writes whole lines under concurrency", async () => {
    await Promise.all(
      Array.from({ length: 50 }, (_, index) =>
        appendGateEvent(root, event({ artifact: `specs/demo/f${index}.md` })),
      ),
    );

    const view = await readLedger(root);
    expect(view.entries).toHaveLength(50);
    expect(view.diagnostics).toEqual([]);
    expect(new Set(view.entries.map((e) => e.artifact)).size).toBe(50);
  });
});
