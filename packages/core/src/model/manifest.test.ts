import { describe, expect, it } from "vitest";
import { parseManifest } from "./manifest.js";

describe("parseManifest", () => {
  it("returns nothing at all when the file is absent — this is not an error", () => {
    const { manifest, diagnostics } = parseManifest(null);
    expect(manifest).toBeNull();
    expect(diagnostics).toEqual([]);
  });

  it("reads a valid manifest and applies defaults", () => {
    const { manifest, diagnostics } = parseManifest(`schema: 2
templates_version: 2.0.0
`);
    expect(diagnostics).toEqual([]);
    expect(manifest).toEqual({
      schema: 2,
      templatesVersion: "2.0.0",
      specsDir: "specs",
      telemetry: "off",
    });
  });

  it("honours an explicit specs_dir", () => {
    const { manifest } = parseManifest(`schema: 2
templates_version: 2.0.0
specs_dir: design
telemetry: off
`);
    expect(manifest?.specsDir).toBe("design");
  });

  it("distinguishes a broken manifest from an absent one", () => {
    const { manifest, diagnostics } = parseManifest("schema: 2\n  bad: [indent\n");
    expect(manifest).toBeNull();
    expect(diagnostics.map((d) => d.code)).toEqual(["manifest-invalid"]);
  });

  it("rejects the wrong schema version", () => {
    const { manifest, diagnostics } = parseManifest(`schema: 1
templates_version: 1.4.0
`);
    expect(manifest).toBeNull();
    expect(diagnostics[0]?.code).toBe("manifest-invalid");
    expect(diagnostics[0]?.message).toContain("schema");
  });

  it("rejects unknown keys rather than tolerating them", () => {
    const { manifest, diagnostics } = parseManifest(`schema: 2
templates_version: 2.0.0
telemetri: on
`);
    expect(manifest).toBeNull();
    expect(diagnostics.map((d) => d.code)).toEqual(["manifest-invalid"]);
  });

  it("rejects a telemetry value other than off", () => {
    const { manifest } = parseManifest(`schema: 2
templates_version: 2.0.0
telemetry: on
`);
    expect(manifest).toBeNull();
  });

  it("rejects a specs_dir that escapes the repository root", () => {
    const { manifest, diagnostics } = parseManifest(`schema: 2
templates_version: 2.0.0
specs_dir: ../../etc
`);
    expect(manifest).toBeNull();
    expect(diagnostics.map((d) => d.code)).toEqual(["manifest-invalid"]);
    expect(diagnostics[0]?.message).toContain("specs_dir");
  });

  it("rejects an absolute specs_dir", () => {
    const { manifest } = parseManifest(`schema: 2
templates_version: 2.0.0
specs_dir: /etc
`);
    expect(manifest).toBeNull();
  });
});
