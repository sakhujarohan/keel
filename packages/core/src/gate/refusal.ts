/**
 * A refusal is not a crash — it is Keel declining to record something it cannot stand behind.
 * Every one names the single next action, so an agent recovers without asking a human.
 */

export type RefusalReason =
  | "not-a-repository"
  | "no-commit"
  | "no-identity"
  | "artifact-missing"
  | "dirty-tree"
  | "already-sealed";

export class GateRefusal extends Error {
  readonly reason: RefusalReason;
  readonly nextAction: string;
  readonly dirtyPaths?: string[];

  constructor(args: {
    reason: RefusalReason;
    message: string;
    nextAction: string;
    dirtyPaths?: string[];
  }) {
    super(args.message);
    this.name = "GateRefusal";
    this.reason = args.reason;
    this.nextAction = args.nextAction;
    if (args.dirtyPaths) this.dirtyPaths = args.dirtyPaths;
  }
}
