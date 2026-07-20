import { describe, expect, it } from "vitest";
import type { GateEvent } from "./event.js";
import { serialiseGateEvent } from "./event.js";
import type { LedgerView, SealKey } from "./ledger.js";
import { gateStatuses, sealStateFor } from "./seal.js";

const HASH = "9f2c41a0b1c2d3e4f5061728394a5b6c7d8e9f01";
const OTHER = "41d0c77aabbccddeeff00112233445566778899a";
const COMMIT = "a4ffc1900112233445566778899aabbccddeeff0";

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

/** An in-memory LedgerView — seal logic is pure, so it needs no filesystem. */
function viewOf(entries: GateEvent[]): LedgerView {
  const keyOf = (k: { run: string; gate: string; artifact: string }) =>
    `${k.run} ${k.gate} ${k.artifact}`;
  return {
    entries,
    diagnostics: [],
    latestFor: (key) => [...entries].reverse().find((e) => keyOf(e) === keyOf(key)),
    historyFor: (key) => entries.filter((e) => keyOf(e) === keyOf(key)),
    keysFor: (run) => {
      const seen = new Map<string, SealKey>();
      for (const e of entries) {
        if (e.run !== run) continue;
        seen.set(keyOf(e), { run: e.run, gate: e.gate, artifact: e.artifact });
      }
      return [...seen.values()];
    },
  };
}

const KEY: SealKey = { run: "demo", gate: "G1", artifact: "specs/demo/requirements.md" };

describe("sealStateFor", () => {
  it("is unsealed when nothing was ever recorded", () => {
    expect(sealStateFor({ key: KEY, view: viewOf([]), currentHash: HASH })).toEqual({
      kind: "unsealed",
    });
  });

  it("is sealed while the content still hashes to what was signed", () => {
    const state = sealStateFor({ key: KEY, view: viewOf([event()]), currentHash: HASH });
    expect(state.kind).toBe("sealed");
  });

  it("breaks when the content drifts", () => {
    const state = sealStateFor({ key: KEY, view: viewOf([event()]), currentHash: OTHER });
    expect(state).toMatchObject({ kind: "broken", currentHash: OTHER });
  });

  it("breaks when the artifact is deleted", () => {
    const state = sealStateFor({ key: KEY, view: viewOf([event()]), currentHash: null });
    expect(state).toMatchObject({ kind: "broken", currentHash: null });
  });

  it("heals when the exact bytes come back", () => {
    const view = viewOf([event()]);
    expect(sealStateFor({ key: KEY, view, currentHash: OTHER }).kind).toBe("broken");
    expect(sealStateFor({ key: KEY, view, currentHash: HASH }).kind).toBe("sealed");
  });

  it("reads as reopened when the last event is a reopen", () => {
    const state = sealStateFor({
      key: KEY,
      view: viewOf([event(), event({ event: "reopen" })]),
      currentHash: HASH,
    });
    expect(state.kind).toBe("reopened");
  });

  it("is sealed again after a reopen is followed by a fresh pass", () => {
    const state = sealStateFor({
      key: KEY,
      view: viewOf([event(), event({ event: "reopen" }), event({ artifact_hash: OTHER })]),
      currentHash: OTHER,
    });
    expect(state.kind).toBe("sealed");
  });
});

describe("gateStatuses", () => {
  const requirements = "specs/demo/requirements.md";
  const hld = "specs/demo/hld.md";
  const stack = "specs/demo/stack.md";
  const lldA = "specs/demo/features/alpha/lld.md";
  const specCheckA = "specs/demo/features/alpha/spec-check.md";
  const lldB = "specs/demo/features/beta/lld.md";

  it("blocks nothing when every earlier gate is sealed", () => {
    const view = viewOf([
      event({ gate: "G1", artifact: requirements }),
      event({ gate: "G2", artifact: hld }),
    ]);
    const statuses = gateStatuses({
      run: "demo",
      view,
      hashes: new Map([
        [requirements, HASH],
        [hld, HASH],
      ]),
    });

    expect(statuses.map((s) => [s.gate, s.blockedBy])).toEqual([
      ["G1", []],
      ["G2", []],
    ]);
  });

  it("invalidates every later gate when an earlier seal breaks", () => {
    const view = viewOf([
      event({ gate: "G1", artifact: requirements }),
      event({ gate: "G2", artifact: hld }),
    ]);
    const statuses = gateStatuses({
      run: "demo",
      view,
      hashes: new Map([
        [requirements, OTHER], // requirements edited after signing
        [hld, HASH],
      ]),
    });

    expect(statuses.find((s) => s.gate === "G1")?.seal.kind).toBe("broken");
    expect(statuses.find((s) => s.gate === "G2")?.blockedBy).toEqual(["G1"]);
  });

  it("treats a gate that never passed as unmet", () => {
    const view = viewOf([event({ gate: "G2", artifact: hld })]);
    const statuses = gateStatuses({ run: "demo", view, hashes: new Map([[hld, HASH]]) });
    expect(statuses[0]?.blockedBy).toEqual(["G1"]);
  });

  it("keeps per-feature gates independent — one feature's unfinished design does not stall another", () => {
    const view = viewOf([
      event({ gate: "G1", artifact: requirements }),
      event({ gate: "G2", artifact: hld }),
      event({ gate: "G3", artifact: stack }),
      event({ gate: "G4", artifact: lldA }),
      event({ gate: "G5", artifact: specCheckA }),
      event({ gate: "G4", artifact: lldB }),
    ]);

    const statuses = gateStatuses({
      run: "demo",
      view,
      hashes: new Map([
        [requirements, HASH],
        [hld, HASH],
        [stack, HASH],
        [lldA, HASH],
        [specCheckA, HASH],
        [lldB, OTHER], // beta's LLD drifted
      ]),
    });

    const betaG4 = statuses.find((s) => s.artifact === lldB);
    const alphaG5 = statuses.find((s) => s.artifact === specCheckA);

    expect(betaG4?.seal.kind).toBe("broken");
    // alpha's spec-check must not care that beta's design moved.
    expect(alphaG5?.blockedBy).toEqual([]);
  });

  it("blocks a feature's G5 when that same feature's G4 breaks", () => {
    const view = viewOf([
      event({ gate: "G1", artifact: requirements }),
      event({ gate: "G2", artifact: hld }),
      event({ gate: "G3", artifact: stack }),
      event({ gate: "G4", artifact: lldA }),
      event({ gate: "G5", artifact: specCheckA }),
    ]);

    const statuses = gateStatuses({
      run: "demo",
      view,
      hashes: new Map([
        [requirements, HASH],
        [hld, HASH],
        [stack, HASH],
        [lldA, OTHER],
        [specCheckA, HASH],
      ]),
    });

    expect(statuses.find((s) => s.artifact === specCheckA)?.blockedBy).toEqual(["G4"]);
  });

  it("returns statuses in gate order", () => {
    const view = viewOf([
      event({ gate: "G4", artifact: lldA }),
      event({ gate: "G1", artifact: requirements }),
      event({ gate: "G2", artifact: hld }),
    ]);
    const statuses = gateStatuses({ run: "demo", view, hashes: new Map() });
    expect(statuses.map((s) => s.gate)).toEqual(["G1", "G2", "G4"]);
  });

  it("serialises a sealed entry unchanged — the view never mutates history", () => {
    const original = event();
    const view = viewOf([original]);
    const state = sealStateFor({ key: KEY, view, currentHash: HASH });
    expect(state.kind === "sealed" && serialiseGateEvent(state.entry)).toBe(
      serialiseGateEvent(original),
    );
  });
});
