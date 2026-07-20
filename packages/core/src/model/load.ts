/**
 * `loadRunModel` — the one way into the model.
 *
 * Walks a repository, parses only the six recognised artifact filenames, and returns an immutable
 * `RepoModel`. Reading is deterministic: no clock, no network, no git, no environment. The only
 * throws are environmental (a bad root, an unreadable file); everything a document gets wrong
 * comes back as a `Diagnostic`.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join, posix } from "node:path";
import { KeelError } from "./errors.js";
import { extractFeatureList, extractRequirements, extractTasks, splitStatus } from "./extract.js";
import { parseFrontmatter } from "./frontmatter.js";
import { isKebabName } from "./ids.js";
import { DEFAULT_SPECS_DIR, MANIFEST_FILENAME, parseManifest } from "./manifest.js";
import { parseSections } from "./sections.js";
import type {
  ArtifactDoc,
  ArtifactType,
  Diagnostic,
  FeatureEntry,
  HldDoc,
  LoadOptions,
  RepoModel,
  RequirementsDoc,
  RunEntry,
  TasksDoc,
} from "./types.js";

const STATUS_FILENAME = "STATUS.md";
const FEATURES_DIRNAME = "features";

export async function loadRunModel(repoRoot: string, opts: LoadOptions = {}): Promise<RepoModel> {
  await assertDirectory(repoRoot);

  const diagnostics: Diagnostic[] = [];

  const manifestRaw = await readMaybe(join(repoRoot, MANIFEST_FILENAME));
  const { manifest, diagnostics: manifestDiagnostics } = parseManifest(manifestRaw);
  diagnostics.push(...manifestDiagnostics);

  const specsDir = manifest?.specsDir ?? DEFAULT_SPECS_DIR;
  const runNames = await listDirectories(join(repoRoot, specsDir));

  const runs: RunEntry[] = [];
  for (const name of runNames) {
    if (opts.runFilter !== undefined && name !== opts.runFilter) continue;

    const run = await loadRun({ repoRoot, specsDir, name, diagnostics });
    if (run) runs.push(run);
  }

  return deepFreeze({
    root: repoRoot,
    manifest,
    runs: runs.sort(byName),
    diagnostics: diagnostics.sort(byLocation),
  });
}

// ---------------------------------------------------------------------------
// runs
// ---------------------------------------------------------------------------

async function loadRun(args: {
  repoRoot: string;
  specsDir: string;
  name: string;
  diagnostics: Diagnostic[];
}): Promise<RunEntry | undefined> {
  const { repoRoot, specsDir, name, diagnostics } = args;
  const dir = posix.join(specsDir, name);

  const context = await loadDoc({
    repoRoot,
    dir,
    file: "context.md",
    type: "context",
    diagnostics,
  });

  const requirements = await loadRequirements({ repoRoot, dir, diagnostics });
  const hld = await loadHld({ repoRoot, dir, diagnostics });

  // stack.md carries G3 and review-checklist.md carries G6; without them the model would be
  // blind to two gates. conventions.md is ungated but belongs to the run.
  const stack = await loadDoc({ repoRoot, dir, file: "stack.md", type: "stack", diagnostics });
  const conventions = await loadDoc({
    repoRoot,
    dir,
    file: "conventions.md",
    type: "conventions",
    diagnostics,
  });
  const review = await loadDoc({
    repoRoot,
    dir,
    file: "review-checklist.md",
    type: "review",
    diagnostics,
  });

  const statusFile = await loadStatus({ repoRoot, dir, diagnostics });
  const features = await loadFeatures({
    repoRoot,
    dir,
    declared: hld?.featureList ?? [],
    diagnostics,
  });

  const isRun =
    context !== undefined ||
    requirements !== undefined ||
    hld !== undefined ||
    stack !== undefined ||
    conventions !== undefined ||
    review !== undefined ||
    statusFile !== undefined ||
    features.length > 0;

  // A directory under specs/ with no recognised artifact is simply not a run — not an error.
  if (!isRun) return undefined;

  if (!isKebabName(name)) {
    diagnostics.push({
      code: "run-name-invalid",
      path: dir,
      message: `Run directory "${name}" is not kebab-case — rename it to lower-case words joined by single dashes.`,
    });
  }

  return {
    name,
    dir,
    ...(context ? { context } : {}),
    ...(requirements ? { requirements } : {}),
    ...(hld ? { hld } : {}),
    ...(stack ? { stack } : {}),
    ...(conventions ? { conventions } : {}),
    ...(review ? { review } : {}),
    features,
    ...(statusFile ? { statusFile } : {}),
  };
}

async function loadRequirements(args: {
  repoRoot: string;
  dir: string;
  diagnostics: Diagnostic[];
}): Promise<RequirementsDoc | undefined> {
  const { repoRoot, dir, diagnostics } = args;
  const doc = await loadDoc({
    repoRoot,
    dir,
    file: "requirements.md",
    type: "requirements",
    diagnostics,
  });
  if (!doc) return undefined;

  const extracted = extractRequirements(doc.sections, doc.path);
  diagnostics.push(...extracted.diagnostics);

  return {
    ...doc,
    requirements: extracted.requirements,
    nfrs: extracted.nfrs,
    mandates: extracted.mandates,
    mandatesExplicitNone: extracted.mandatesExplicitNone,
    assumptions: extracted.assumptions,
  };
}

async function loadHld(args: {
  repoRoot: string;
  dir: string;
  diagnostics: Diagnostic[];
}): Promise<HldDoc | undefined> {
  const { repoRoot, dir, diagnostics } = args;
  const doc = await loadDoc({ repoRoot, dir, file: "hld.md", type: "hld", diagnostics });
  if (!doc) return undefined;

  const { featureList, diagnostics: extractDiagnostics } = extractFeatureList(
    doc.sections,
    doc.path,
  );
  diagnostics.push(...extractDiagnostics);

  return { ...doc, featureList };
}

async function loadStatus(args: {
  repoRoot: string;
  dir: string;
  diagnostics: Diagnostic[];
}): Promise<RunEntry["statusFile"]> {
  const { repoRoot, dir, diagnostics } = args;
  const path = posix.join(dir, STATUS_FILENAME);

  const raw = await readMaybe(join(repoRoot, path));
  if (raw === null) return undefined;

  const { statusSplit, diagnostics: splitDiagnostics } = splitStatus(raw, path);
  diagnostics.push(...splitDiagnostics);
  return statusSplit;
}

// ---------------------------------------------------------------------------
// features
// ---------------------------------------------------------------------------

async function loadFeatures(args: {
  repoRoot: string;
  dir: string;
  declared: { name: string }[];
  diagnostics: Diagnostic[];
}): Promise<FeatureEntry[]> {
  const { repoRoot, dir, declared, diagnostics } = args;

  const featuresDir = posix.join(dir, FEATURES_DIRNAME);
  const onDisk = await listDirectories(join(repoRoot, featuresDir));
  const declaredNames = declared.map((feature) => feature.name);

  // The feature set is the union: an LLD can exist before the HLD names it, and vice versa —
  // `declaredInHld` is what lets a rule tell the two apart.
  const names = [...new Set([...declaredNames, ...onDisk])].sort();

  const features: FeatureEntry[] = [];
  for (const name of names) {
    const featureDir = posix.join(featuresDir, name);

    const lld = await loadDoc({
      repoRoot,
      dir: featureDir,
      file: "lld.md",
      type: "lld",
      diagnostics,
    });
    const specCheck = await loadDoc({
      repoRoot,
      dir: featureDir,
      file: "spec-check.md",
      type: "spec-check",
      diagnostics,
    });
    const tasks = await loadTasks({ repoRoot, dir: featureDir, diagnostics });

    features.push({
      name,
      declaredInHld: declaredNames.includes(name),
      ...(lld ? { lld } : {}),
      ...(specCheck ? { specCheck } : {}),
      ...(tasks ? { tasks } : {}),
    });
  }

  return features;
}

async function loadTasks(args: {
  repoRoot: string;
  dir: string;
  diagnostics: Diagnostic[];
}): Promise<TasksDoc | undefined> {
  const { repoRoot, dir, diagnostics } = args;
  const doc = await loadDoc({ repoRoot, dir, file: "tasks.md", type: "tasks", diagnostics });
  if (!doc) return undefined;

  const { tasks, diagnostics: extractDiagnostics } = extractTasks(doc.sections, doc.path);
  diagnostics.push(...extractDiagnostics);

  return { ...doc, tasks };
}

// ---------------------------------------------------------------------------
// documents
// ---------------------------------------------------------------------------

async function loadDoc(args: {
  repoRoot: string;
  dir: string;
  file: string;
  type: ArtifactType;
  diagnostics: Diagnostic[];
}): Promise<ArtifactDoc | undefined> {
  const { repoRoot, dir, file, type, diagnostics } = args;
  const path = posix.join(dir, file);

  const raw = await readMaybe(join(repoRoot, path));
  if (raw === null) return undefined;

  const { frontmatter, diagnostics: frontmatterDiagnostics } = parseFrontmatter({
    raw,
    path,
    expectedType: type,
  });
  diagnostics.push(...frontmatterDiagnostics);

  return { path, type, frontmatter, sections: parseSections(raw) };
}

// ---------------------------------------------------------------------------
// filesystem
// ---------------------------------------------------------------------------

async function assertDirectory(repoRoot: string): Promise<void> {
  try {
    const stats = await stat(repoRoot);
    if (!stats.isDirectory()) {
      throw new KeelError({
        code: "ENV_BAD_ROOT",
        message: `${repoRoot} is not a directory.`,
        nextAction: "Point keel at the root of a git repository.",
        path: repoRoot,
      });
    }
  } catch (error) {
    if (error instanceof KeelError) throw error;
    throw new KeelError({
      code: "ENV_BAD_ROOT",
      message: `Cannot read ${repoRoot} (${errorCode(error)}).`,
      nextAction: "Point keel at the root of a git repository.",
      path: repoRoot,
    });
  }
}

/** Missing is a normal answer; anything else is an environment failure worth stopping for. */
async function readMaybe(absolutePath: string): Promise<string | null> {
  try {
    return await readFile(absolutePath, "utf8");
  } catch (error) {
    const code = errorCode(error);
    if (code === "ENOENT" || code === "EISDIR") return null;
    throw new KeelError({
      code: "ENV_UNREADABLE",
      message: `Cannot read ${absolutePath} (${code}).`,
      nextAction: "Fix the file's permissions, then re-run.",
      path: absolutePath,
    });
  }
}

async function listDirectories(absolutePath: string): Promise<string[]> {
  try {
    const entries = await readdir(absolutePath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    const code = errorCode(error);
    if (code === "ENOENT" || code === "ENOTDIR") return [];
    throw new KeelError({
      code: "ENV_UNREADABLE",
      message: `Cannot list ${absolutePath} (${code}).`,
      nextAction: "Fix the directory's permissions, then re-run.",
      path: absolutePath,
    });
  }
}

function errorCode(error: unknown): string {
  return (error as NodeJS.ErrnoException)?.code ?? "unknown";
}

// ---------------------------------------------------------------------------
// ordering and immutability
// ---------------------------------------------------------------------------

function byName(a: { name: string }, b: { name: string }): number {
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

/** Stable ordering is part of the determinism contract: same tree in, same bytes out. */
function byLocation(a: Diagnostic, b: Diagnostic): number {
  if (a.path !== b.path) return a.path < b.path ? -1 : 1;
  const lineA = a.line ?? 0;
  const lineB = b.line ?? 0;
  if (lineA !== lineB) return lineA - lineB;
  return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}
