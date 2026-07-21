#!/usr/bin/env node
/**
 * The `keel` command.
 *
 * Every command is thin: parse, call core, render. The one piece of logic that lives here is the
 * exit code, computed in a single place (M3) — 0 clean or warn-only, 1 a blocking verdict,
 * 2 the environment being wrong. A hook depends on being able to tell the last two apart.
 */

import { createInterface } from "node:readline/promises";
import {
  assertSafeRepoPath,
  buildContext,
  commitSeal,
  createGitAnchor,
  createRun,
  deriveRunState,
  diagnose,
  type Gate,
  GateRefusal,
  gateStatuses,
  init,
  KeelError,
  loadRunModel,
  prepareSeal,
  readLedger,
  reopenGate,
  requireGateFast,
  runChecks,
  setArtifactState,
  upgrade,
  writeStatus,
} from "@keel-dev/core";
import { Command } from "commander";
import { type Format, renderProbes, renderReport, renderScaffold, renderState } from "./format.js";

const EXIT_OK = 0;
const EXIT_BLOCKED = 1;
const EXIT_ENVIRONMENT = 2;

const program = new Command();

program
  .name("keel")
  .description("Gate enforcement for AI-assisted development")
  .version("2.0.0-alpha");

program
  .command("init")
  .description("scaffold keel.yaml, templates and adapter hooks (never overwrites)")
  .action(
    run(async () => {
      const result = await init({ repoRoot: process.cwd() });
      say(renderScaffold(result));
      say("\nnext: keel run new <name>");
      return EXIT_OK;
    }),
  );

program
  .command("run")
  .argument("<subcommand>", '"new"')
  .argument("<name>", "kebab-case run name")
  .description("create a new run under specs/")
  .action(
    run(async (subcommand: string, name: string) => {
      if (subcommand !== "new") {
        throw new KeelError({
          code: "ENV_BAD_ROOT",
          message: `Unknown subcommand "${subcommand}".`,
          nextAction: "Use: keel run new <name>",
        });
      }
      assertSafeRepoPath(process.cwd(), name);
      const result = await createRun({ repoRoot: process.cwd(), name });
      say(renderScaffold(result));
      say(`\nnext: frame the problem in specs/${name}/context.md, then draft requirements`);
      return EXIT_OK;
    }),
  );

program
  .command("check")
  .description("check the repository against the rule catalog")
  .option("--run <name>", "limit to one run")
  .option("--strict", "treat a repo with no keel.yaml as an error")
  .option("--format <format>", "human | agent | ci", "human")
  .option("--require <gate>", "assert one gate is sealed (the fast hook path)")
  .option("--feature <name>", "narrow --require to one feature (G4/G5)")
  .action(
    run(async (opts: Record<string, string | undefined>) => {
      const repoRoot = process.cwd();
      const format = (opts.format ?? "human") as Format;
      const anchor = createGitAnchor(repoRoot);

      if (opts.run) {
        assertSafeRepoPath(repoRoot, opts.run);
      }
      if (opts.feature) {
        assertSafeRepoPath(repoRoot, opts.feature);
      }

      // The hook path: answer one question without parsing a single markdown file.
      if (opts.require) {
        if (!opts.run) {
          throw new KeelError({
            code: "ENV_BAD_ROOT",
            message: "--require needs to know which run.",
            nextAction: "Add --run <name>.",
          });
        }
        const report = await requireGateFast({
          repoRoot,
          anchor,
          run: opts.run,
          gate: opts.require as Gate,
          ...(opts.feature ? { feature: opts.feature } : {}),
        });
        say(renderReport(report, format));
        return report.exitCode === 1 ? EXIT_BLOCKED : EXIT_OK;
      }

      const ctx = await buildContext({
        repoRoot,
        anchor,
        needCommits: true,
        ...(opts.run ? { runFilter: opts.run } : {}),
      });

      // Strict turns "not a keel repo" from a quiet pass into an environment error — but the
      // report hides that flag under strict, so read it from the manifest the context loaded.
      if (opts.strict && ctx.model.manifest === null) {
        throw new KeelError({
          code: "ENV_BAD_ROOT",
          message: "Not a keel repository (no keel.yaml), and --strict was requested.",
          nextAction: "Run: keel init",
        });
      }

      const report = runChecks(ctx, {
        ...(opts.run ? { run: opts.run } : {}),
        ...(opts.strict ? { strict: true } : {}),
      });

      say(renderReport(report, format));
      return report.exitCode === 1 ? EXIT_BLOCKED : EXIT_OK;
    }),
  );

const gate = program.command("gate").description("seal and reopen gates");

gate
  .command("pass")
  .argument("<gate>", "G1…G6")
  .requiredOption("--run <name>", "run name")
  .requiredOption("--artifact <path>", "repo-relative artifact being sealed")
  .option("--allow-dirty", "seal over a dirty tree (stamped in the ledger)")
  .option("--yes", "skip the confirmation prompt")
  .description("seal a gate after showing exactly what is being signed")
  .action(
    run(async (gateId: string, opts: Record<string, string | boolean | undefined>) => {
      const repoRoot = process.cwd();
      const anchor = createGitAnchor(repoRoot);
      const runName = opts.run as string;
      const artifact = opts.artifact as string;

      assertSafeRepoPath(repoRoot, runName);
      assertSafeRepoPath(repoRoot, artifact);

      const prepared = await prepareSeal({
        repoRoot,
        anchor,
        run: runName,
        gate: gateId as Gate,
        artifact,
        ...(opts.allowDirty ? { allowDirty: true } : {}),
      });

      // Print before writing — this is the whole reason prepare and commit are separate.
      say("sealing:");
      say(`  run       ${prepared.entry.run}`);
      say(`  gate      ${prepared.entry.gate}`);
      say(`  artifact  ${prepared.entry.artifact}`);
      say(`  hash      ${prepared.entry.artifact_hash.slice(0, 12)}`);
      say(`  actor     ${prepared.entry.actor}`);
      say(
        `  commit    ${prepared.entry.commit.slice(0, 7)}${prepared.entry.dirty ? "  (dirty tree)" : ""}`,
      );

      if (!opts.yes && !(await confirm())) {
        say("aborted — nothing was written");
        return EXIT_OK;
      }

      await commitSeal({ repoRoot, prepared });
      await project({ repoRoot, runName, artifact, status: "signed-off" });
      say(`\n${gateId} sealed ✓`);
      return EXIT_OK;
    }),
  );

gate
  .command("reopen")
  .argument("<gate>", "G1…G6")
  .requiredOption("--run <name>", "run name")
  .requiredOption("--artifact <path>", "repo-relative artifact")
  .description("reopen a gate, preserving its history")
  .action(
    run(async (gateId: string, opts: Record<string, string>) => {
      const repoRoot = process.cwd();
      const runName = opts.run as string;
      const artifact = opts.artifact as string;

      assertSafeRepoPath(repoRoot, runName);
      assertSafeRepoPath(repoRoot, artifact);

      await reopenGate({
        repoRoot,
        anchor: createGitAnchor(repoRoot),
        run: runName,
        gate: gateId as Gate,
        artifact,
      });
      await project({
        repoRoot,
        runName,
        artifact,
        status: "reopened",
      });
      say(`${gateId} reopened — re-confirm it, then: keel gate pass ${gateId} --run ${runName}`);
      return EXIT_OK;
    }),
  );

program
  .command("status")
  .description("regenerate the derived Now block from the ledger")
  .option("--run <name>", "limit to one run")
  .action(
    run(async (opts: Record<string, string | undefined>) => {
      const repoRoot = process.cwd();
      if (opts.run) {
        assertSafeRepoPath(repoRoot, opts.run);
      }

      const model = await loadRunModel(repoRoot, opts.run ? { runFilter: opts.run } : {});
      const ledger = await readLedger(repoRoot);
      const anchor = createGitAnchor(repoRoot);

      for (const entry of model.runs) {
        const paths = ledger.keysFor(entry.name).map((key) => key.artifact);
        const hashes = await anchor.hashObjects([...new Set(paths)].sort());
        const state = deriveRunState({
          run: entry,
          gates: gateStatuses({ run: entry.name, view: ledger, hashes }),
        });

        say(renderState(state));
        const result = await writeStatus({ repoRoot, run: entry, state });
        say(
          result.changed ? `  ✓ ${result.path} regenerated` : `  ○ ${result.path} already current`,
        );
      }

      if (model.runs.length === 0) say("no runs found under specs/");
      return EXIT_OK;
    }),
  );

program
  .command("upgrade")
  .description("migrate a v1 repository to schema v2 (refuses on a dirty tree)")
  .action(
    run(async () => {
      const repoRoot = process.cwd();
      const result = await upgrade({ repoRoot, anchor: createGitAnchor(repoRoot) });

      if (result.manifestWritten) say("  ✓ keel.yaml written");
      say(`  ✓ ${result.artifactsMigrated.length} artifact(s) migrated to schema 2`);
      say(
        `  ✓ ${result.ledgerBackfilled} gate(s) backfilled (legacy: true — recorded, not verified)`,
      );
      for (const skipped of result.skipped) say(`  ○ ${skipped}`);
      say("\nre-running is a no-op. next: keel check");
      return EXIT_OK;
    }),
  );

program
  .command("doctor")
  .description("check the environment without changing anything")
  .action(
    run(async () => {
      const repoRoot = process.cwd();
      const probes = await diagnose({ repoRoot, anchor: createGitAnchor(repoRoot) });
      say(renderProbes(probes));
      return EXIT_OK;
    }),
  );

// ---------------------------------------------------------------------------
// plumbing
// ---------------------------------------------------------------------------

/** Update the artifact's state frontmatter, then re-project STATUS. Best-effort by design. */
async function project(args: {
  repoRoot: string;
  runName: string;
  artifact: string;
  status: "signed-off" | "reopened";
}): Promise<void> {
  const { repoRoot, runName, artifact, status } = args;

  assertSafeRepoPath(repoRoot, artifact);

  await setArtifactState({
    repoRoot,
    path: artifact,
    status,
    updated: new Date().toISOString().slice(0, 10),
  });

  const model = await loadRunModel(repoRoot, { runFilter: runName });
  const entry = model.runs.find((candidate) => candidate.name === runName);
  if (!entry) return;

  const ledger = await readLedger(repoRoot);
  const hashes = await createGitAnchor(repoRoot).hashObjects(
    [...new Set(ledger.keysFor(runName).map((key) => key.artifact))].sort(),
  );
  const state = deriveRunState({
    run: entry,
    gates: gateStatuses({ run: runName, view: ledger, hashes }),
  });
  await writeStatus({ repoRoot, run: entry, state });
}

/** Silence is never consent: with no TTY and no --yes, refuse rather than assume. */
async function confirm(): Promise<boolean> {
  if (!process.stdin.isTTY) {
    throw new GateRefusal({
      reason: "dirty-tree",
      message: "Cannot ask for confirmation without a terminal.",
      nextAction: "Re-run with --yes if you have already reviewed what is being sealed.",
    });
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question("proceed? [y/N] ");
    return answer.trim().toLowerCase() === "y";
  } finally {
    rl.close();
  }
}

function say(message: string): void {
  process.stdout.write(`${message}\n`);
}

/** The single place an exit code is decided. */
function run<A extends unknown[]>(handler: (...args: A) => Promise<number>) {
  return async (...args: A): Promise<void> => {
    try {
      process.exitCode = await handler(...args);
    } catch (error) {
      if (error instanceof KeelError || error instanceof GateRefusal) {
        process.stderr.write(`keel: ${error.message}\n  → ${error.nextAction}\n`);
        process.exitCode = EXIT_ENVIRONMENT;
        return;
      }
      throw error;
    }
  };
}

await program.parseAsync(process.argv);
