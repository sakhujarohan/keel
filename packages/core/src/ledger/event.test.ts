import { describe, expect, it } from "vitest";
import {
  featureOfArtifact,
  type GateEvent,
  parseGateEventLine,
  serialiseGateEvent,
} from "./event.js";

const HASH = "9f2c41a0b1c2d3e4f5061728394a5b6c7d8e9f01";
const COMMIT = "a4ffc1900112233445566778899aabbccddeeff0";

const EVENT: GateEvent = {
  run: "keel-v2",
  gate: "G1",
  event: "pass",
  artifact: "specs/keel-v2/requirements.md",
  artifact_hash: HASH,
  actor: "Rohan Sakhuja <rohansakhuja.work@gmail.com>",
  commit: COMMIT,
  ts: "2026-07-13T11:42:03.001Z",
};

describe("serialiseGateEvent", () => {
  it("emits the mandated fields in the mandated order", () => {
    const line = serialiseGateEvent(EVENT);
    expect(Object.keys(JSON.parse(line))).toEqual([
      "run",
      "gate",
      "event",
      "artifact",
      "artifact_hash",
      "actor",
      "commit",
      "ts",
    ]);
  });

  it("writes dirty and legacy only when they are true", () => {
    expect(serialiseGateEvent(EVENT)).not.toContain("dirty");
    const flagged = serialiseGateEvent({ ...EVENT, dirty: true, legacy: true });
    expect(Object.keys(JSON.parse(flagged)).slice(-2)).toEqual(["dirty", "legacy"]);
  });

  it("round-trips", () => {
    const parsed = parseGateEventLine(serialiseGateEvent(EVENT));
    expect(parsed.ok && parsed.event).toEqual(EVENT);
  });

  it("produces a single line", () => {
    expect(serialiseGateEvent(EVENT)).not.toContain("\n");
  });
});

describe("parseGateEventLine", () => {
  it("rejects an unknown field — the entry shape is closed", () => {
    const line = JSON.stringify({ ...EVENT, feature: "run-model" });
    const parsed = parseGateEventLine(line);
    expect(parsed.ok).toBe(false);
    expect(parsed.ok === false && parsed.code).toBe("ledger-entry-invalid");
  });

  it("separates unparseable JSON from an invalid entry", () => {
    const broken = parseGateEventLine("{not json");
    expect(broken.ok === false && broken.code).toBe("ledger-line-malformed");

    const invalid = parseGateEventLine(JSON.stringify({ ...EVENT, gate: "G9" }));
    expect(invalid.ok === false && invalid.code).toBe("ledger-entry-invalid");
  });

  it("rejects a hash or commit that is not an object id", () => {
    expect(parseGateEventLine(JSON.stringify({ ...EVENT, artifact_hash: "nope" })).ok).toBe(false);
    expect(parseGateEventLine(JSON.stringify({ ...EVENT, commit: "" })).ok).toBe(false);
  });

  it("rejects a timestamp that is not ISO-8601 UTC with milliseconds", () => {
    expect(parseGateEventLine(JSON.stringify({ ...EVENT, ts: "2026-07-13" })).ok).toBe(false);
  });

  it("rejects dirty: false — the flag is present-or-absent", () => {
    expect(parseGateEventLine(JSON.stringify({ ...EVENT, dirty: false })).ok).toBe(false);
  });

  it("accepts a sha256 object id", () => {
    const sha256 = "a".repeat(64);
    const parsed = parseGateEventLine(
      JSON.stringify({ ...EVENT, artifact_hash: sha256, commit: sha256 }),
    );
    expect(parsed.ok).toBe(true);
  });
});

describe("featureOfArtifact", () => {
  it("finds the feature a per-feature gate belongs to", () => {
    expect(featureOfArtifact("specs/keel-v2/features/run-model/lld.md")).toBe("run-model");
    expect(featureOfArtifact("specs/keel-v2/requirements.md")).toBeNull();
  });
});
