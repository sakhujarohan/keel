import { describe, expect, it } from "vitest";
import { KeelError } from "./errors.js";
import { assertSafeRepoPath } from "./paths.js";

describe("assertSafeRepoPath", () => {
  it("allows safe relative paths inside repo root", () => {
    const repoRoot = "/app";
    expect(assertSafeRepoPath(repoRoot, "specs/v2/context.md")).toBe("specs/v2/context.md");
    expect(assertSafeRepoPath(repoRoot, "./specs/v2/context.md")).toBe("specs/v2/context.md");
  });

  it("throws KeelError on path traversal attempts outside repo root", () => {
    const repoRoot = "/app";
    expect(() => assertSafeRepoPath(repoRoot, "../.env")).toThrow(KeelError);
    expect(() => assertSafeRepoPath(repoRoot, "../../etc/passwd")).toThrow(KeelError);
    expect(() => assertSafeRepoPath(repoRoot, "specs/../../.env")).toThrow(KeelError);
  });
});
