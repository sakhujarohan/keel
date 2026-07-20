import { describe, expect, it } from "vitest";
import { isAnyValidId, isKebabName, isValidId, parseIdList } from "./ids.js";

describe("ID grammar", () => {
  it("accepts well-formed IDs", () => {
    expect(isValidId("requirement", "R1")).toBe(true);
    expect(isValidId("requirement", "R14")).toBe(true);
    expect(isValidId("nfr", "N7")).toBe(true);
    expect(isValidId("mandate", "M9")).toBe(true);
    expect(isValidId("assumption", "A5")).toBe(true);
    expect(isValidId("task", "T12")).toBe(true);
  });

  it("rejects malformed IDs", () => {
    expect(isValidId("requirement", "R01x")).toBe(false);
    expect(isValidId("requirement", "r1")).toBe(false);
    expect(isValidId("requirement", "")).toBe(false);
    expect(isValidId("requirement", "R")).toBe(false);
    expect(isValidId("requirement", "R1 ")).toBe(false);
    expect(isValidId("task", "T-1")).toBe(false);
  });

  it("does not confuse one ID kind for another", () => {
    expect(isValidId("requirement", "N1")).toBe(false);
    expect(isValidId("task", "R1")).toBe(false);
    expect(isAnyValidId("N1")).toBe(true);
    expect(isAnyValidId("X1")).toBe(false);
  });
});

describe("run and feature names", () => {
  it("accepts kebab-case", () => {
    expect(isKebabName("seat-hold")).toBe(true);
    expect(isKebabName("run-model")).toBe(true);
    expect(isKebabName("keel-v2")).toBe(true);
    expect(isKebabName("checkout")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isKebabName("Waitlist")).toBe(false);
    expect(isKebabName("seat_hold")).toBe(false);
    expect(isKebabName("-leading")).toBe(false);
    expect(isKebabName("trailing-")).toBe(false);
    expect(isKebabName("double--dash")).toBe(false);
    expect(isKebabName("")).toBe(false);
  });
});

describe("parseIdList", () => {
  it("splits on commas and middots", () => {
    expect(parseIdList("R1, R2, R3")).toEqual(["R1", "R2", "R3"]);
    expect(parseIdList("R1 · N2")).toEqual(["R1", "N2"]);
  });

  it("strips markdown decoration authors add", () => {
    expect(parseIdList("`R1`, **R2**")).toEqual(["R1", "R2"]);
  });

  it("treats placeholder cells as empty", () => {
    expect(parseIdList("")).toEqual([]);
    expect(parseIdList("—")).toEqual([]);
    expect(parseIdList("  -  ")).toEqual([]);
    expect(parseIdList("None")).toEqual([]);
  });

  it("keeps unrecognised tokens so callers can diagnose them", () => {
    expect(parseIdList("R1, banana")).toEqual(["R1", "banana"]);
  });
});
