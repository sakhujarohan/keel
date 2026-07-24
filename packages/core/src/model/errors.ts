/**
 * The failure channel. Content problems are `Diagnostic` values; *environment* problems — a bad
 * root, an unreadable file — throw a `KeelError` and surface as exit code 2, so a hook can always
 * tell "Keel says no" from "Keel is broken".
 */

export type KeelErrorCode = "ENV_BAD_ROOT" | "ENV_UNREADABLE" | "ENV_NO_GIT";

export class KeelError extends Error {
  readonly code: KeelErrorCode;
  /** The single imperative step that would resolve this. */
  readonly nextAction: string;
  readonly path?: string;

  constructor(args: { code: KeelErrorCode; message: string; nextAction: string; path?: string }) {
    super(args.message);
    this.name = "KeelError";
    this.code = args.code;
    this.nextAction = args.nextAction;
    if (args.path !== undefined) this.path = args.path;
  }
}
