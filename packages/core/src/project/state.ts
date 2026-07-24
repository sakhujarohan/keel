/**
 * Deriving what a run's state actually is.
 *
 * Everything here is a pure function of (run, gate statuses). No clock, no filesystem — which is
 * what lets `keel status` be re-run at any time and produce the same answer.
 */

import { GATE_ORDER } from "../ledger/event.js";
import type { GateStatus } from "../ledger/seal.js";
import type { Gate, RunEntry } from "../model/types.js";

export interface GateLine {
  gate: Gate;
  /** ✓ sealed · ▶ reopened, in progress · ⚠ broken or resting on an unsealed gate · — no record */
  glyph: "✓" | "▶" | "⚠" | "—";
  date?: string;
}

export interface RunState {
  run: string;
  phase: number;
  phaseName: string;
  gates: GateLine[];
  tasksDone: number;
  tasksTotal: number;
  nextAction: string;
}

const PHASE_NAMES = [
  "Kickoff",
  "Requirements",
  "High-Level Design",
  "Stack Selection",
  "Low-Level Design",
  "Spec-Compliance Review",
  "Task Breakdown",
  "Build & Test",
  "Harden & Review",
] as const;

/** Which phase a sealed gate means you have finished. G6 sits at the end of Phase 8. */
const PHASE_OF_GATE: Record<Gate, number> = {
  G1: 1,
  G2: 2,
  G3: 3,
  G4: 4,
  G5: 5,
  G6: 8,
};

export function deriveRunState(args: { run: RunEntry; gates: GateStatus[] }): RunState {
  const { run, gates } = args;

  const lines = GATE_ORDER.map((gate) => gateLine(gate, gates));
  const sealed = lines.filter((line) => line.glyph === "✓").map((line) => line.gate);
  const furthest = sealed.at(-1);

  const tasks = run.features.flatMap((feature) => feature.tasks?.tasks ?? []);
  const tasksDone = tasks.filter((task) => task.done).length;

  // Tasks in flight mean the work has moved past the gates into Phase 7, whatever is sealed.
  const gatePhase = furthest ? PHASE_OF_GATE[furthest] : 0;
  const phase = tasks.length > 0 && tasksDone < tasks.length && gatePhase >= 5 ? 7 : gatePhase;

  return {
    run: run.name,
    phase,
    phaseName: PHASE_NAMES[phase] ?? "Kickoff",
    gates: lines,
    tasksDone,
    tasksTotal: tasks.length,
    nextAction: nextAction({ lines, tasksDone, tasksTotal: tasks.length, run: run.name }),
  };
}

function gateLine(gate: Gate, gates: GateStatus[]): GateLine {
  const relevant = gates.filter((status) => status.gate === gate);
  if (relevant.length === 0) return { gate, glyph: "—" };

  const troubled = relevant.find(
    (status) => status.seal.kind === "broken" || status.blockedBy.length > 0,
  );
  if (troubled) return { gate, glyph: "⚠" };

  if (relevant.some((status) => status.seal.kind === "reopened")) return { gate, glyph: "▶" };

  if (relevant.every((status) => status.seal.kind === "sealed")) {
    // Date of the most recent sealing event across this gate's artifacts.
    const dates = relevant
      .flatMap((status) => (status.seal.kind === "sealed" ? [status.seal.entry.ts] : []))
      .sort();
    const latest = dates.at(-1);
    return { gate, glyph: "✓", ...(latest ? { date: latest.slice(0, 10) } : {}) };
  }

  return { gate, glyph: "—" };
}

/** The one thing the reader should do next, in order of urgency. */
function nextAction(args: {
  lines: GateLine[];
  tasksDone: number;
  tasksTotal: number;
  run: string;
}): string {
  const { lines, tasksDone, tasksTotal, run } = args;

  const troubled = lines.find((line) => line.glyph === "⚠");
  if (troubled) {
    return `${troubled.gate} no longer holds — restore the sealed content, or re-confirm and run: keel gate pass ${troubled.gate} --run ${run}`;
  }

  const reopened = lines.find((line) => line.glyph === "▶");
  if (reopened) {
    return `${reopened.gate} is reopened — re-confirm it, then run: keel gate pass ${reopened.gate} --run ${run}`;
  }

  const nextUnsealed = lines.find((line) => line.glyph === "—");
  const building = tasksTotal > 0 && tasksDone < tasksTotal;

  // Once the design gates are sealed, unfinished tasks are the work — G6 is not something to seal
  // until the building is done.
  if (building && (!nextUnsealed || nextUnsealed.gate === "G6")) {
    return `Continue building: ${tasksTotal - tasksDone} of ${tasksTotal} tasks remain.`;
  }

  if (nextUnsealed) {
    return `Produce and confirm the artifact for ${nextUnsealed.gate}, then run: keel gate pass ${nextUnsealed.gate} --run ${run}`;
  }

  return "Every gate is sealed — run the review and ship it.";
}
