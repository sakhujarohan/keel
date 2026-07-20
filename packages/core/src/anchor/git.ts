/**
 * The one door to git.
 *
 * Nothing else in the package shells out or reads git state. Blob ids are computed natively —
 * `sha1("blob " + byteLength + "\0" + bytes)` *is* the definition of a git object id — which keeps
 * a process spawn off the hook path. `git hash-object` equality is enforced by test, because M1
 * fixes that value.
 */

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { KeelError } from "../model/errors.js";

const exec = promisify(execFile);

export interface TreeStatus {
  clean: boolean;
  /** Repo-relative paths, sorted — shown verbatim when a seal is refused. */
  dirtyPaths: string[];
}

export interface GitAnchor {
  isRepository(): Promise<boolean>;
  /** `"Name <email>"`, or null when git has no identity configured. Never invented (N5). */
  identity(): Promise<string | null>;
  /** Full object id of HEAD, or null in a repository with no commits. */
  headCommit(): Promise<string | null>;
  treeStatus(): Promise<TreeStatus>;
  /** Blob id per repo-relative path; null where the file does not exist. */
  hashObjects(paths: string[]): Promise<Map<string, string | null>>;
}

export function createGitAnchor(repoRoot: string): GitAnchor {
  let objectFormat: "sha1" | "sha256" | undefined;

  async function git(args: string[]): Promise<{ stdout: string; ok: boolean }> {
    try {
      const { stdout } = await exec("git", args, { cwd: repoRoot, maxBuffer: 32 * 1024 * 1024 });
      return { stdout, ok: true };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new KeelError({
          code: "ENV_NO_GIT",
          message: "git was not found on PATH.",
          nextAction: "Install git, or run keel where git is available.",
        });
      }
      // A non-zero exit is an answer ("no commits yet", "not a repository"), not a failure.
      return { stdout: "", ok: false };
    }
  }

  async function resolveObjectFormat(): Promise<"sha1" | "sha256"> {
    if (objectFormat) return objectFormat;
    const { stdout, ok } = await git(["config", "extensions.objectFormat"]);
    objectFormat = ok && stdout.trim() === "sha256" ? "sha256" : "sha1";
    return objectFormat;
  }

  return {
    async isRepository() {
      return (await git(["rev-parse", "--git-dir"])).ok;
    },

    async identity() {
      const [name, email] = await Promise.all([
        git(["config", "user.name"]),
        git(["config", "user.email"]),
      ]);
      const trimmedName = name.stdout.trim();
      const trimmedEmail = email.stdout.trim();
      if (!trimmedName || !trimmedEmail) return null;
      return `${trimmedName} <${trimmedEmail}>`;
    },

    async headCommit() {
      const { stdout, ok } = await git(["rev-parse", "HEAD"]);
      const sha = stdout.trim();
      return ok && sha ? sha : null;
    },

    async treeStatus() {
      const { stdout } = await git(["status", "--porcelain"]);
      const dirtyPaths = stdout
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map(parseStatusPath)
        .sort();
      return { clean: dirtyPaths.length === 0, dirtyPaths };
    },

    async hashObjects(paths) {
      const format = await resolveObjectFormat();
      if (format === "sha256") return hashViaGit(git, paths);

      const result = new Map<string, string | null>();
      for (const path of paths) {
        result.set(path, await nativeBlobId(join(repoRoot, path)));
      }
      return result;
    },
  };
}

/** `XY path` — and for a rename, `R  old -> new`, where the new path is the interesting one. */
function parseStatusPath(line: string): string {
  const withoutStatus = line.slice(3);
  const renameArrow = withoutStatus.indexOf(" -> ");
  const path = renameArrow >= 0 ? withoutStatus.slice(renameArrow + 4) : withoutStatus;
  return path.replace(/^"(.*)"$/, "$1");
}

/** The git object id of a file's contents, computed without spawning git. */
async function nativeBlobId(absolutePath: string): Promise<string | null> {
  let bytes: Buffer;
  try {
    bytes = await readFile(absolutePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "EISDIR") return null;
    throw new KeelError({
      code: "ENV_UNREADABLE",
      message: `Cannot read ${absolutePath} (${code}).`,
      nextAction: "Fix the file's permissions, then re-run.",
      path: absolutePath,
    });
  }

  return createHash("sha1")
    .update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]))
    .digest("hex");
}

/** sha256 repositories are rare enough to be worth a subprocess rather than a second algorithm. */
async function hashViaGit(
  git: (args: string[]) => Promise<{ stdout: string; ok: boolean }>,
  paths: string[],
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  for (const path of paths) {
    const { stdout, ok } = await git(["hash-object", "--", path]);
    result.set(path, ok && stdout.trim() ? stdout.trim() : null);
  }
  return result;
}
