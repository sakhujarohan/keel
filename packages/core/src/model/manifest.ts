/**
 * `keel.yaml` — the repo-level manifest.
 *
 * Three states, deliberately distinguished:
 *   absent            → null, no diagnostics  ("not a keel repo" — safe to run anywhere)
 *   valid             → Manifest
 *   present + broken  → null + `manifest-invalid`  ("a broken keel repo", which must block)
 */

import YAML from "yaml";
import { z } from "zod";
import type { Diagnostic, Manifest } from "./types.js";

/** Strict: an unknown key is a mistake to report, not something to tolerate silently. */
const schema = z.strictObject({
  schema: z.literal(2),
  templates_version: z.string().min(1),
  specs_dir: z.string().min(1).optional(),
  telemetry: z.literal("off").optional(),
});

export interface ManifestResult {
  manifest: Manifest | null;
  diagnostics: Diagnostic[];
}

export const MANIFEST_FILENAME = "keel.yaml";
export const DEFAULT_SPECS_DIR = "specs";

/** `raw` is null when the file does not exist. */
export function parseManifest(raw: string | null): ManifestResult {
  if (raw === null) return { manifest: null, diagnostics: [] };

  let data: unknown;
  try {
    data = YAML.parse(raw);
  } catch (error) {
    return {
      manifest: null,
      diagnostics: [invalid(`is not valid YAML (${(error as Error).message.split("\n")[0]})`)],
    };
  }

  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path.join(".");
    const detail = field ? `field \`${field}\`: ${issue?.message}` : (issue?.message ?? "invalid");
    return { manifest: null, diagnostics: [invalid(detail)] };
  }

  return {
    manifest: {
      schema: 2,
      templatesVersion: result.data.templates_version,
      specsDir: result.data.specs_dir ?? DEFAULT_SPECS_DIR,
      telemetry: "off",
    },
    diagnostics: [],
  };
}

function invalid(detail: string): Diagnostic {
  return {
    code: "manifest-invalid",
    path: MANIFEST_FILENAME,
    line: 1,
    message: `${MANIFEST_FILENAME} ${detail} — fix it, or run keel init to regenerate it.`,
  };
}
