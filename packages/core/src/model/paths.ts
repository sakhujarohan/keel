/**
 * Path validation and canonicalization helpers for repository safety.
 */

import { isAbsolute, normalize, relative, resolve } from "node:path";
import { KeelError } from "./errors.js";

/**
 * Asserts that a relative path stays safely within the repository root directory.
 * Returns the normalized relative path.
 * Throws a KeelError if the path attempts to traverse outside repoRoot.
 */
export function assertSafeRepoPath(repoRoot: string, inputPath: string): string {
  const normalized = normalize(inputPath);
  const absolutePath = resolve(repoRoot, normalized);
  const rel = relative(repoRoot, absolutePath);

  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new KeelError({
      code: "ENV_BAD_ROOT",
      message: `Access denied: "${inputPath}" attempts to traverse outside the repository root.`,
      nextAction: "Provide a valid path inside the repository root.",
      path: absolutePath,
    });
  }

  return rel;
}
