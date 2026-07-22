/**
 * The one door to git.
 *
 * Nothing else in the package shells out or reads git state. Blob ids are computed natively —
 * `sha1("blob " + byteLength + "\0" + bytes)` *is* the definition of a git object id — which keeps
 * a process spawn off the hook path. `git hash-object` equality is enforced by test, because M1
 * fixes that value.
 */

import { execFile, spawn } from "node:child_process";
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
  /**
   * Blob id of in-memory content — the same value `hashObjects` would report if these exact
   * bytes were on disk at that path. Needed because a seal hashes the artifact's *projected*
   * content (post frontmatter-flip), which never touches disk before the seal is written.
   */
  hashContent(bytes: Buffer | string): Promise<string>;
  /** Recent commits with their parsed trailers — read only when a rule needs attribution. */
  recentCommits(limit: number): Promise<CommitRecord[]>;
}

export interface CommitRecord {
  sha: string;
  subject: string;
  trailers: Record<string, string>;
  /** Repo-relative paths the commit touched, so a rule can tell whether it concerns a run. */
  files: string[];
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

    async hashContent(bytes) {
      const format = await resolveObjectFormat();
      const buffer = typeof bytes === "string" ? Buffer.from(bytes, "utf8") : bytes;
      if (format === "sha256") return hashObjectStdin(repoRoot, buffer);
      return blobId(buffer);
    },

    async recentCommits(limit) {
      // Records start with \x1e and separate fields with \x1f — neither appears in a commit
      // message — so the file list can trail the last field without ambiguity.
      const { stdout, ok } = await git([
        "log",
        `-${limit}`,
        "--no-merges",
        "--name-only",
        "--pretty=format:%x1e%H%x1f%s%x1f%(trailers:only=true,unfold=true)%x1f",
      ]);
      if (!ok) return [];

      return stdout
        .split("\x1e")
        .filter((record) => record.trim().length > 0)
        .map((record) => {
          const [sha = "", subject = "", trailerBlock = "", fileBlock = ""] = record.split("\x1f");
          return {
            sha: sha.trim(),
            subject: subject.trim(),
            trailers: parseTrailers(trailerBlock),
            files: fileBlock
              .split("\n")
              .map((file) => file.trim())
              .filter((file) => file.length > 0),
          };
        });
    },
  };
}

function parseTrailers(block: string): Record<string, string> {
  const trailers: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    trailers[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return trailers;
}

/** `XY path` — and for a rename, `R  old -> new`, where the new path is the interesting one. */
function parseStatusPath(line: string): string {
  const withoutStatus = line.slice(3);
  const renameArrow = withoutStatus.indexOf(" -> ");
  const path = renameArrow >= 0 ? withoutStatus.slice(renameArrow + 4) : withoutStatus;
  return path.replace(/^"(.*)"$/, "$1");
}

/** The git blob id of arbitrary bytes — the same value `git hash-object` would print for them. */
export function blobId(bytes: Buffer | string): string {
  const buffer = typeof bytes === "string" ? Buffer.from(bytes, "utf8") : bytes;
  return createHash("sha1")
    .update(Buffer.concat([Buffer.from(`blob ${buffer.length}\0`), buffer]))
    .digest("hex");
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

  return blobId(bytes);
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

/**
 * `git hash-object --stdin`, for content that has no file on disk yet (a seal's projected bytes).
 * `execFile`'s promisified form has no way to write to the child's stdin, so this spawns directly.
 */
async function hashObjectStdin(repoRoot: string, bytes: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", ["hash-object", "--stdin"], { cwd: repoRoot });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        reject(
          new KeelError({
            code: "ENV_NO_GIT",
            message: "git was not found on PATH.",
            nextAction: "Install git, or run keel where git is available.",
          }),
        );
        return;
      }
      reject(error);
    });
    child.on("close", (code) => {
      if (code === 0 && stdout.trim()) {
        resolve(stdout.trim());
      } else {
        reject(
          new KeelError({
            code: "ENV_UNREADABLE",
            message: `git hash-object --stdin failed (${stderr.trim() || `exit ${code}`}).`,
            nextAction: "Check that git is working in this repository, then re-run.",
          }),
        );
      }
    });
    child.stdin.end(bytes);
  });
}
