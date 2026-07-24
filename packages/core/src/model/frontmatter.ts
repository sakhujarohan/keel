/**
 * Artifact frontmatter: the small YAML block every artifact opens with.
 *
 * Parsing never throws. A malformed block still yields a best-effort `Frontmatter` so the document
 * enters the model and the rules can report precisely what is wrong.
 */

import matter from "gray-matter";
import YAML from "yaml";
import { z } from "zod";
import type { ArtifactType, Diagnostic, Frontmatter } from "./types.js";

/**
 * Parse frontmatter with the YAML 1.2 core schema, where `updated: 2026-07-13` stays a string.
 * (js-yaml, gray-matter's default, would hand back a Date.)
 */
const engines = { yaml: (raw: string) => YAML.parse(raw) as Record<string, unknown> };

const ARTIFACT_TYPES = [
  "context",
  "requirements",
  "hld",
  "stack",
  "conventions",
  "lld",
  "spec-check",
  "tasks",
  "review",
] as const;

const STATUSES = ["draft", "set", "gate-pending", "signed-off", "reopened"] as const;

/** Unknown keys are allowed through and dropped: v1 templates carry extra scaffolding. */
const schema = z.object({
  artifact: z.enum(ARTIFACT_TYPES),
  phase: z.number().int().min(0).max(8),
  gate: z.union([z.enum(["G1", "G2", "G3", "G4", "G5", "G6"]), z.literal("—")]),
  status: z.enum(STATUSES),
  updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD"),
  schema_version: z.union([z.literal(1), z.literal(2)]).optional(),
});

export interface FrontmatterResult {
  frontmatter: Frontmatter;
  diagnostics: Diagnostic[];
}

/** What we fall back to when the block is missing or unusable. */
function fallback(expectedType: ArtifactType): Frontmatter {
  return {
    artifact: expectedType,
    phase: 0,
    gate: "—",
    status: "draft",
    updated: "",
    schemaVersion: 1,
  };
}

export function parseFrontmatter(args: {
  raw: string;
  path: string;
  expectedType: ArtifactType;
}): FrontmatterResult {
  const { raw, path, expectedType } = args;
  const diagnostics: Diagnostic[] = [];

  let data: Record<string, unknown>;
  try {
    const parsed = matter(raw, { engines });
    if (!parsed.matter.trim()) {
      return {
        frontmatter: fallback(expectedType),
        diagnostics: [
          {
            code: "frontmatter-missing",
            path,
            line: 1,
            message: `${path} has no frontmatter block — add a --- block with artifact, phase, gate, status, updated.`,
          },
        ],
      };
    }
    data = parsed.data as Record<string, unknown>;
  } catch (error) {
    return {
      frontmatter: fallback(expectedType),
      diagnostics: [
        {
          code: "frontmatter-invalid",
          path,
          line: 1,
          message: `${path} frontmatter is not valid YAML (${(error as Error).message.split("\n")[0]}) — fix the block delimited by ---.`,
        },
      ],
    };
  }

  const result = schema.safeParse(data);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path.join(".") || "(root)";
      diagnostics.push({
        code: "frontmatter-invalid",
        path,
        line: 1,
        message: `${path} frontmatter field \`${field}\` is invalid (${issue.message}) — correct it in the --- block.`,
      });
    }
    return { frontmatter: bestEffort(data, expectedType), diagnostics };
  }

  const value = result.data;
  if (value.artifact !== expectedType) {
    diagnostics.push({
      code: "artifact-type-mismatch",
      path,
      line: 1,
      message: `${path} declares artifact: ${value.artifact} but its filename implies ${expectedType} — align the frontmatter with the file.`,
    });
  }

  return {
    frontmatter: {
      artifact: value.artifact,
      phase: value.phase,
      gate: value.gate,
      status: value.status,
      updated: value.updated,
      schemaVersion: value.schema_version ?? 1,
    },
    diagnostics,
  };
}

/** Keep whatever fields did parse; fall back for the rest. */
function bestEffort(data: Record<string, unknown>, expectedType: ArtifactType): Frontmatter {
  const base = fallback(expectedType);
  const artifact = data.artifact;
  const phase = data.phase;
  const gate = data.gate;
  const status = data.status;
  const updated = data.updated;
  const schemaVersion = data.schema_version;

  return {
    artifact: (ARTIFACT_TYPES as readonly string[]).includes(artifact as string)
      ? (artifact as ArtifactType)
      : base.artifact,
    phase: typeof phase === "number" && Number.isInteger(phase) ? phase : base.phase,
    gate:
      typeof gate === "string" && /^(G[1-6]|—)$/.test(gate)
        ? (gate as Frontmatter["gate"])
        : base.gate,
    status: (STATUSES as readonly string[]).includes(status as string)
      ? (status as Frontmatter["status"])
      : base.status,
    updated: typeof updated === "string" ? updated : base.updated,
    schemaVersion: schemaVersion === 2 ? 2 : 1,
  };
}
