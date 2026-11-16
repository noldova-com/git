/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception, type ExceptionOptions } from "@noldova/context.exceptions";
import type { JsonException, JsonObject, JsonReader } from "@noldova/context.json";

/**
 * The JSON types the protocol's messages read and write, from `@noldova/context.json`.
 *
 * @example
 * ```ts
 * import type { JsonObject } from "@noldova/git.protocol";
 *
 * export const value: JsonObject = { branch: "main" };
 * ```
 */
export type { JsonObject, JsonValue } from "@noldova/context.json";

/**
 * The shared failure codes every call can carry.
 * @example
 * ```ts
 * import { FailureCode } from "@noldova/git.protocol";
 * export function isPermissionAnswer(code: FailureCode): boolean {
 *   return code === FailureCode.Denied || code === FailureCode.Expired || code === FailureCode.Withdrawn;
 * }
 * ```
 */
export declare const FailureCode: {
  /**
   * The request was invalid, such as a path outside the worktree.
   */
  readonly Refused: "Refused";

  /**
   * The person denied the permission request.
   */
  readonly Denied: "Denied";

  /**
   * Nobody answered the permission request in time.
   */
  readonly Expired: "Expired";

  /**
   * The call ended before the person answered the permission request.
   */
  readonly Withdrawn: "Withdrawn";

  /**
   * HEAD or an affected object changed after the grant, so nothing ran.
   */
  readonly Stale: "Stale";

  /**
   * The call's time limit passed, and its program was stopped.
   */
  readonly TimedOut: "TimedOut";

  /**
   * The result cannot fit its limit, even truncated.
   */
  readonly TooLarge: "TooLarge";

  /**
   * The module cannot serve the call now.
   */
  readonly Unavailable: "Unavailable";

  /**
   * The folder is not inside a Git repository.
   */
  readonly NotRepository: "NotRepository";

  /**
   * A Git failure, which a {@link GitCode} names.
   */
  readonly Git: "Git";
};

/**
 * One of {@link FailureCode}'s wire values.
 */
export type FailureCode = (typeof FailureCode)[keyof typeof FailureCode];

/**
 * The Git failure codes a call carries with {@link FailureCode.Git}.
 * @example
 * ```ts
 * import { GitCode } from "@noldova/git.protocol";
 * export function needsGh(code: GitCode): boolean {
 *   return code === GitCode.GhMissing || code === GitCode.GhTooOld;
 * }
 * ```
 */
export declare const GitCode: {
  /**
   * The path is not inside a git repository.
   */
  readonly NotARepository: "NotARepository";

  /**
   * The folder is there, but the person's account may not read it.
   */
  readonly FolderUnreadable: "FolderUnreadable";

  /**
   * git refuses the repository because another user owns it; the module never adds it to `safe.directory` itself.
   */
  readonly UnsafeRepository: "UnsafeRepository";

  /**
   * Another process holds the repository's `index.lock`, which the module never deletes.
   */
  readonly IndexLocked: "IndexLocked";

  /**
   * The action cannot run on unresolved conflicts.
   */
  readonly Conflict: "Conflict";

  /**
   * The branch is already checked out in another worktree.
   */
  readonly BranchCheckedOut: "BranchCheckedOut";

  /**
   * Another tool locked the worktree.
   */
  readonly LockedElsewhere: "LockedElsewhere";

  /**
   * git kept the branch because it holds commits that its upstream, or HEAD when it has none, doesn't hold.
   */
  readonly BranchUnmerged: "BranchUnmerged";

  /**
   * Nothing is staged.
   */
  readonly NothingToCommit: "NothingToCommit";

  /**
   * A hook refused the commit.
   */
  readonly HookFailed: "HookFailed";

  /**
   * The remote refused the push.
   */
  readonly PushRejected: "PushRejected";

  /**
   * git refused to switch because the switch would overwrite changes in the worktree; git's output, which names the files, comes with the failure as untrusted text.
   */
  readonly ChangesInTheWay: "ChangesInTheWay";

  /**
   * The remote's SSH host key isn't known or doesn't match, so git stopped; the module never trusts a host key, and git's output, with the key's fingerprint, comes with the failure as untrusted text.
   */
  readonly HostKeyUnknown: "HostKeyUnknown";

  /**
   * The remote refused the person's SSH key.
   */
  readonly KeyRefused: "KeyRefused";

  /**
   * The remote asked for a name or password and git has no credential helper that answers without a terminal.
   */
  readonly CredentialsNeeded: "CredentialsNeeded";

  /**
   * The checked-out branch has no upstream to pull from, or its upstream is gone.
   */
  readonly NoUpstream: "NoUpstream";

  /**
   * The branch and its upstream each hold commits the other doesn't, so a pull can't fast-forward it.
   */
  readonly Diverged: "Diverged";

  /**
   * A write was cancelled, or passed its deadline, after it started, so its outcome is uncertain and the state must be read again before any retry.
   */
  readonly OutcomeUnknown: "OutcomeUnknown";

  /**
   * git's output couldn't be read as the module expects, such as a status line it doesn't know; the message names what, never the raw bytes.
   */
  readonly UnreadableOutput: "UnreadableOutput";

  /**
   * git cannot be found or started.
   */
  readonly GitMissing: "GitMissing";

  /**
   * git is older than 2.39.
   */
  readonly GitTooOld: "GitTooOld";

  /**
   * gh cannot be found or started.
   */
  readonly GhMissing: "GhMissing";

  /**
   * gh is older than 2.18.0.
   */
  readonly GhTooOld: "GhTooOld";

  /**
   * `gh auth status` exited 1: gh may be signed out, hold an invalid token or not reach GitHub.
   */
  readonly GhSignInUnconfirmed: "GhSignInUnconfirmed";

  /**
   * A gh command exited 4, because it needs a sign-in.
   */
  readonly GhSignInNeeded: "GhSignInNeeded";
};

/**
 * One of {@link GitCode}'s wire values.
 */
export type GitCode = (typeof GitCode)[keyof typeof GitCode];

/**
 * How much an action can change, which decides whether it asks the person first.
 * @example
 * ```ts
 * import { RiskLevel } from "@noldova/git.protocol";
 * export function alwaysAsks(risk: RiskLevel): boolean {
 *   return risk === RiskLevel.LocalDestructive || risk === RiskLevel.Remote;
 * }
 * ```
 */
export declare const RiskLevel: {
  /**
   * Reads only, and never asks.
   */
  readonly Read: "Read";

  /**
   * Changes that can be taken back, such as staging, and doesn't ask.
   */
  readonly LocalReversible: "LocalReversible";

  /**
   * Records a commit, and asks unless the answer is remembered for the repository.
   */
  readonly Commit: "Commit";

  /**
   * Loses local work, and always asks; the answer is never remembered.
   */
  readonly LocalDestructive: "LocalDestructive";

  /**
   * Reaches a remote or GitHub, and always asks.
   */
  readonly Remote: "Remote";
};

/**
 * One of {@link RiskLevel}'s wire values.
 */
export type RiskLevel = (typeof RiskLevel)[keyof typeof RiskLevel];

/**
 * Where untrusted text came from, so the app shows it as data and never as instructions.
 * @example
 * ```ts
 * import { UntrustedSource } from "@noldova/git.protocol";
 * export function fromGitHub(source: UntrustedSource): boolean {
 *   return source === UntrustedSource.GitHub;
 * }
 * ```
 */
export declare const UntrustedSource: {
  /**
   * The repository or its configuration, such as file contents, commit messages, and git's or a hook's output.
   */
  readonly Repository: "Repository";

  /**
   * GitHub, such as PR titles and bodies, checks and gh's output.
   */
  readonly GitHub: "GitHub";
};

/**
 * One of {@link UntrustedSource}'s wire values.
 */
export type UntrustedSource = (typeof UntrustedSource)[keyof typeof UntrustedSource];

/**
 * A path's state in the index or the worktree, as git's status reports it.
 * @example
 * ```ts
 * import { FileState } from "@noldova/git.protocol";
 * export function isNew(state: FileState): boolean {
 *   return state === FileState.Added || state === FileState.Untracked;
 * }
 * ```
 */
export declare const FileState: {
  /**
   * Unchanged on this side.
   */
  readonly Unmodified: "Unmodified";

  /**
   * The content changed.
   */
  readonly Modified: "Modified";

  /**
   * The kind changed, such as a file that became a symbolic link.
   */
  readonly TypeChanged: "TypeChanged";

  /**
   * Added to the index.
   */
  readonly Added: "Added";

  /**
   * Deleted.
   */
  readonly Deleted: "Deleted";

  /**
   * Renamed; the entry carries the original path.
   */
  readonly Renamed: "Renamed";

  /**
   * Copied; the entry carries the original path.
   */
  readonly Copied: "Copied";

  /**
   * Not tracked; set on both sides.
   */
  readonly Untracked: "Untracked";

  /**
   * Ignored; set on both sides, and only read when git reports it.
   */
  readonly Ignored: "Ignored";
};

/**
 * One of {@link FileState}'s wire values.
 */
export type FileState = (typeof FileState)[keyof typeof FileState];

/**
 * How an unmerged path conflicts, by which sides changed it.
 * @example
 * ```ts
 * import { ConflictKind } from "@noldova/git.protocol";
 * export function bothChanged(kind: ConflictKind): boolean {
 *   return kind === ConflictKind.BothModified || kind === ConflictKind.BothAdded;
 * }
 * ```
 */
export declare const ConflictKind: {
  /**
   * Both sides changed the file.
   */
  readonly BothModified: "BothModified";

  /**
   * Both sides added a file at the path.
   */
  readonly BothAdded: "BothAdded";

  /**
   * Both sides deleted the file.
   */
  readonly BothDeleted: "BothDeleted";

  /**
   * Only our side added the file.
   */
  readonly AddedByUs: "AddedByUs";

  /**
   * Only their side added the file.
   */
  readonly AddedByThem: "AddedByThem";

  /**
   * Our side deleted the file, and theirs changed it.
   */
  readonly DeletedByUs: "DeletedByUs";

  /**
   * Their side deleted the file, and ours changed it.
   */
  readonly DeletedByThem: "DeletedByThem";
};

/**
 * One of {@link ConflictKind}'s wire values.
 */
export type ConflictKind = (typeof ConflictKind)[keyof typeof ConflictKind];

/**
 * What a diff compares.
 * @example
 * ```ts
 * import { DiffScopeKind } from "@noldova/git.protocol";
 * export function needsRevisions(kind: DiffScopeKind): boolean {
 *   return kind === DiffScopeKind.Range;
 * }
 * ```
 */
export declare const DiffScopeKind: {
  /**
   * The worktree against the index, untracked files included as added.
   */
  readonly Worktree: "Worktree";

  /**
   * The index against HEAD.
   */
  readonly Staged: "Staged";

  /**
   * One revision against another.
   */
  readonly Range: "Range";
};

/**
 * One of {@link DiffScopeKind}'s wire values.
 */
export type DiffScopeKind = (typeof DiffScopeKind)[keyof typeof DiffScopeKind];

/**
 * How a file changed in a diff.
 * @example
 * ```ts
 * import { FileChange } from "@noldova/git.protocol";
 * export function isMove(change: FileChange): boolean {
 *   return change === FileChange.Renamed || change === FileChange.Copied;
 * }
 * ```
 */
export declare const FileChange: {
  /**
   * The file is new; it has no old mode.
   */
  readonly Added: "Added";

  /**
   * The content or the mode changed.
   */
  readonly Modified: "Modified";

  /**
   * The file is gone; it has no new mode.
   */
  readonly Deleted: "Deleted";

  /**
   * The file moved from its old path.
   */
  readonly Renamed: "Renamed";

  /**
   * The file was copied from its old path.
   */
  readonly Copied: "Copied";

  /**
   * The kind changed, such as a file that became a symbolic link.
   */
  readonly TypeChanged: "TypeChanged";

  /**
   * The path is unmerged.
   */
  readonly Conflict: "Conflict";
};

/**
 * One of {@link FileChange}'s wire values.
 */
export type FileChange = (typeof FileChange)[keyof typeof FileChange];

/**
 * A diff line's kind.
 * @example
 * ```ts
 * import { LineKind } from "@noldova/git.protocol";
 * export function isChange(kind: LineKind): boolean {
 *   return kind === LineKind.Added || kind === LineKind.Removed;
 * }
 * ```
 */
export declare const LineKind: {
  /**
   * Unchanged, with both line numbers.
   */
  readonly Context: "Context";

  /**
   * Added, with only a new line number.
   */
  readonly Added: "Added";

  /**
   * Removed, with only an old line number.
   */
  readonly Removed: "Removed";

  /**
   * git's marker that the line before it has no newline at the end, with no line numbers.
   */
  readonly NoNewlineAtEnd: "NoNewlineAtEnd";
};

/**
 * One of {@link LineKind}'s wire values.
 */
export type LineKind = (typeof LineKind)[keyof typeof LineKind];

/**
 * The operation a worktree is in the middle of, which stopped for a conflict or for the person to go on.
 * @example
 * ```ts
 * import { OperationKind } from "@noldova/git.protocol";
 * export function rewritesHistory(kind: OperationKind): boolean {
 *   return kind === OperationKind.Rebase;
 * }
 * ```
 */
export declare const OperationKind: {
  /**
   * A merge, from `git merge`.
   */
  readonly Merge: "Merge";

  /**
   * A rebase, from `git rebase`, interactive or not.
   */
  readonly Rebase: "Rebase";

  /**
   * A cherry-pick, from `git cherry-pick`.
   */
  readonly CherryPick: "CherryPick";

  /**
   * A revert, from `git revert`.
   */
  readonly Revert: "Revert";
};

/**
 * One of {@link OperationKind}'s wire values.
 */
export type OperationKind = (typeof OperationKind)[keyof typeof OperationKind];

/**
 * How git reaches a remote, read from its URL.
 * @example
 * ```ts
 * import { RemoteTransport } from "@noldova/git.protocol";
 * export function isNetwork(transport: RemoteTransport): boolean {
 *   return transport === RemoteTransport.Ssh || transport === RemoteTransport.Https;
 * }
 * ```
 */
export declare const RemoteTransport: {
  /**
   * SSH, as `ssh://` or the `user@host:path` form.
   */
  readonly Ssh: "Ssh";

  /**
   * HTTPS.
   */
  readonly Https: "Https";

  /**
   * A local path or a `file://` URL.
   */
  readonly File: "File";

  /**
   * Any other transport, such as `git://` or a remote helper.
   */
  readonly Other: "Other";
};

/**
 * One of {@link RemoteTransport}'s wire values.
 */
export type RemoteTransport = (typeof RemoteTransport)[keyof typeof RemoteTransport];

/**
 * The base of the protocol's own exceptions; catch it to catch them all.
 * A model's `fromJson` also throws context's `JsonException`, which isn't under this base.
 * It is abstract: a value that breaks a model's rule throws {@link ProtocolFieldException}.
 * @example
 * ```ts
 * import { ProtocolException } from "@noldova/git.protocol";
 * export function isProtocolFailure(error: unknown): boolean {
 *   return error instanceof ProtocolException;
 * }
 * ```
 */
export declare abstract class ProtocolException extends Exception {
  /**
   * Creates the exception; only the protocol's own exceptions call it.
   * @param message The message, from the protocol's resources.
   * @param options The cause, when there is one.
   * @example
   * ```ts
   * import { ProtocolException, ProtocolFieldException } from "@noldova/git.protocol";
   * const failure: ProtocolException = new ProtocolFieldException("$.folder", "an absolute path");
   * console.log(failure.message);
   * ```
   */
  protected constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a value doesn't fit the protocol, such as a missing, unknown or invalid field.
 * @example
 * ```ts
 * import { ProtocolFieldException } from "@noldova/git.protocol";
 * export const failure: ProtocolFieldException = new ProtocolFieldException("$.key", "a text");
 * ```
 */
export declare class ProtocolFieldException extends ProtocolException {
  /**
   * The invalid field's path, such as `$.base`, or its bare name when the value didn't come from JSON.
   */
  public readonly field: string;

  /**
   * What the field should hold, such as `a full hexadecimal object id`, which the message names.
   */
  public readonly expectation: string;

  /**
   * Creates the exception.
   * @param field The invalid field's path or name.
   * @param expectation What the field should hold, such as `a text`, which the message names.
   * @example
   * ```ts
   * import { ProtocolFieldException } from "@noldova/git.protocol";
   * export function refuseBase(): never {
   *   throw new ProtocolFieldException("$.base", "a full hexadecimal object id");
   * }
   * ```
   */
  public constructor(field: string, expectation: string);
}

/**
 * A worktree that belongs to one key of the app: where it is, its branch and the commit it started from.
 * The key never appears in the path or the branch.
 * @example
 * ```ts
 * import type { WorktreeRecord } from "@noldova/git.protocol";
 * export function describe(record: WorktreeRecord): string {
 *   return `${record.branch} at ${record.path}`;
 * }
 * ```
 */
export declare class WorktreeRecord {
  /**
   * The app's opaque key, which owns the worktree.
   */
  public readonly key: string;

  /**
   * The absolute path of the repository's main worktree.
   */
  public readonly repository: string;

  /**
   * The absolute path of the worktree, under the module's work folder.
   */
  public readonly path: string;

  /**
   * The name of the worktree's branch, without `refs/heads/`.
   */
  public readonly branch: string;

  /**
   * The full id of the commit the worktree started from.
   */
  public readonly base: string;

  /**
   * Creates a record.
   * @param key The app's key; not empty.
   * @param repository The repository's absolute path; not empty.
   * @param path The worktree's absolute path; not empty.
   * @param branch The branch's name; not empty.
   * @param base The starting commit's full id in lowercase hexadecimal: 40 digits, or 64 in a SHA-256 repository.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When a text is empty or the base isn't a full object id.
   * @example
   * ```ts
   * import { WorktreeRecord } from "@noldova/git.protocol";
   * export const record: WorktreeRecord = new WorktreeRecord("k1", "/work/repository", "/data/work/git/1f2e", "noldova/1f2e", "0123456789abcdef0123456789abcdef01234567");
   * // new WorktreeRecord("k1", "/r", "/p", "b", "HEAD") throws, naming the field base.
   * ```
   */
  public constructor(key: string, repository: string, path: string, branch: string, base: string, reader?: JsonReader);

  /**
   * Reads a record from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The record's path in error messages; `$` by default.
   * @returns The record.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   * @example
   * ```ts
   * import { WorktreeRecord } from "@noldova/git.protocol";
   * export function readRecord(text: string): WorktreeRecord {
   *   return WorktreeRecord.fromJson(JSON.parse(text));
   * }
   * ```
   */
  public static fromJson(value: unknown, path?: string): WorktreeRecord;

  /**
   * Writes the record's JSON form.
   * @returns A new plain object with `key`, `repository`, `path`, `branch` and `base`.
   * @example
   * ```ts
   * import type { WorktreeRecord } from "@noldova/git.protocol";
   * export function send(record: WorktreeRecord): string {
   *   return JSON.stringify(record.toJson());
   * }
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The upstream branch of the checked-out branch, and how far apart they are.
 * @example
 * ```ts
 * import type { StatusUpstream } from "@noldova/git.protocol";
 * export function describe(upstream: StatusUpstream): string {
 *   return upstream.gone ? `${upstream.name} is gone` : `${upstream.ahead} ahead, ${upstream.behind} behind ${upstream.name}`;
 * }
 * ```
 */
export declare class StatusUpstream {
  /**
   * The upstream's name, such as `origin/main`; untrusted.
   */
  public readonly name: string;

  /**
   * The commits the branch has that the upstream doesn't.
   */
  public readonly ahead: number;

  /**
   * The commits the upstream has that the branch doesn't.
   */
  public readonly behind: number;

  /**
   * Whether the upstream branch no longer exists; then `ahead` and `behind` are 0.
   */
  public readonly gone: boolean;

  /**
   * Creates the upstream.
   * @param name The upstream's name; not empty.
   * @param ahead The commits ahead; zero or more.
   * @param behind The commits behind; zero or more.
   * @param gone Whether the upstream is gone.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the name is empty, a count isn't a whole number of zero or more, or a gone upstream has a count above 0.
   * @example
   * ```ts
   * import { StatusUpstream } from "@noldova/git.protocol";
   * export const upstream: StatusUpstream = new StatusUpstream("origin/main", 2, 0, false);
   * ```
   */
  public constructor(name: string, ahead: number, behind: number, gone: boolean, reader?: JsonReader);

  /**
   * Reads the upstream from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The upstream's path in error messages; `$` by default.
   * @returns The upstream.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   * @example
   * ```ts
   * import { StatusUpstream } from "@noldova/git.protocol";
   * export const upstream: StatusUpstream = StatusUpstream.fromJson({ name: "origin/main", ahead: 0, behind: 1, gone: false });
   * ```
   */
  public static fromJson(value: unknown, path?: string): StatusUpstream;

  /**
   * Writes the upstream's JSON form, with the fields `name`, `ahead`, `behind` and `gone`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { StatusUpstream, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new StatusUpstream("origin/main", 0, 0, false).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * What changed inside a submodule, as git's status reports it.
 * @example
 * ```ts
 * import type { SubmoduleStatus } from "@noldova/git.protocol";
 * export function isDirty(submodule: SubmoduleStatus): boolean {
 *   return submodule.trackedChanges || submodule.untrackedChanges;
 * }
 * ```
 */
export declare class SubmoduleStatus {
  /**
   * Whether the submodule's checked-out commit differs from the one recorded.
   */
  public readonly commitChanged: boolean;

  /**
   * Whether the submodule has changes to tracked files.
   */
  public readonly trackedChanges: boolean;

  /**
   * Whether the submodule has untracked files.
   */
  public readonly untrackedChanges: boolean;

  /**
   * Creates the status.
   * @param commitChanged Whether the commit changed.
   * @param trackedChanges Whether tracked files changed.
   * @param untrackedChanges Whether untracked files exist.
   * @example
   * ```ts
   * import { SubmoduleStatus } from "@noldova/git.protocol";
   * export const submodule: SubmoduleStatus = new SubmoduleStatus(true, false, false);
   * ```
   */
  public constructor(commitChanged: boolean, trackedChanges: boolean, untrackedChanges: boolean);

  /**
   * Reads the status from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The status's path in error messages; `$` by default.
   * @returns The status.
   * @throws {JsonException} When the value isn't an object, or a field is missing or not a boolean; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field.
   * @example
   * ```ts
   * import { SubmoduleStatus } from "@noldova/git.protocol";
   * export const submodule: SubmoduleStatus = SubmoduleStatus.fromJson({ commitChanged: false, trackedChanges: true, untrackedChanges: false });
   * ```
   */
  public static fromJson(value: unknown, path?: string): SubmoduleStatus;

  /**
   * Writes the status's JSON form, with the fields `commitChanged`, `trackedChanges` and `untrackedChanges`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { SubmoduleStatus, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new SubmoduleStatus(false, false, true).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The lines one side of a changed path adds and removes, as `git diff --numstat` counts them.
 * @example
 * ```ts
 * import type { LineCounts } from "@noldova/git.protocol";
 * export function describe(counts: LineCounts): string {
 *   return `+${counts.added} -${counts.removed}`;
 * }
 * ```
 */
export declare class LineCounts {
  /**
   * The lines added.
   */
  public readonly added: number;

  /**
   * The lines removed.
   */
  public readonly removed: number;

  /**
   * Creates the counts.
   * @param added The lines added; a whole number of zero or more.
   * @param removed The lines removed; a whole number of zero or more.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When a count isn't a whole number of zero or more.
   * @example
   * ```ts
   * import { LineCounts } from "@noldova/git.protocol";
   * export const counts: LineCounts = new LineCounts(12, 3);
   * ```
   */
  public constructor(added: number, removed: number, reader?: JsonReader);

  /**
   * Reads the counts from their JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The counts' path in error messages; `$` by default.
   * @returns The counts.
   * @throws {JsonException} When the value isn't an object, or a field is missing or not an integer; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a count is below 0.
   * @example
   * ```ts
   * import { LineCounts } from "@noldova/git.protocol";
   * export const counts: LineCounts = LineCounts.fromJson({ added: 1, removed: 0 });
   * ```
   */
  public static fromJson(value: unknown, path?: string): LineCounts;

  /**
   * Writes the counts' JSON form, with the fields `added` and `removed`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { LineCounts, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new LineCounts(0, 2).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * One path in git's status, with its state in the index and in the worktree.
 * An untracked or ignored path has that state on both sides, and an unmerged path has its `conflict` kind with both states `Unmodified`.
 * @example
 * ```ts
 * import { FileState, type StatusEntry } from "@noldova/git.protocol";
 * export function isStaged(entry: StatusEntry): boolean {
 *   return entry.index !== FileState.Unmodified && entry.index !== FileState.Untracked && entry.index !== FileState.Ignored;
 * }
 * ```
 */
export declare class StatusEntry {
  /**
   * The path, relative to the worktree's root with `/`; untrusted.
   */
  public readonly path: string;

  /**
   * The path's bytes in base64, only when they aren't valid UTF-8; otherwise absent, and left out of the JSON form.
   */
  public readonly pathBytes: string | undefined;

  /**
   * The path it was renamed or copied from, exactly when either state is `Renamed` or `Copied`; otherwise `null`; untrusted.
   */
  public readonly originalPath: string | null;

  /**
   * The original path's bytes in base64, only when they aren't valid UTF-8; otherwise absent, and left out of the JSON form.
   */
  public readonly originalPathBytes: string | undefined;

  /**
   * The state in the index, against HEAD.
   */
  public readonly index: FileState;

  /**
   * The state in the worktree, against the index.
   */
  public readonly worktree: FileState;

  /**
   * How the path conflicts, or `null` when it is merged.
   */
  public readonly conflict: ConflictKind | null;

  /**
   * What changed inside the submodule at this path, or `null` when the path isn't a submodule.
   */
  public readonly submodule: SubmoduleStatus | null;

  /**
   * The lines the index adds and removes against HEAD, or `null` when the runtime didn't count them, such as for a binary file or an unchanged side.
   */
  public readonly indexCounts: LineCounts | null;

  /**
   * The lines the worktree adds and removes against the index, or `null` when the runtime didn't count them, such as for a binary file or an unchanged side.
   */
  public readonly worktreeCounts: LineCounts | null;

  /**
   * Creates the entry.
   * @param path The path; not empty.
   * @param pathBytes The path's bytes in base64, or `undefined`.
   * @param originalPath The original path, exactly when either state is `Renamed` or `Copied`.
   * @param originalPathBytes The original path's bytes in base64, or `undefined`; always `undefined` without an original path.
   * @param index The state in the index.
   * @param worktree The state in the worktree.
   * @param conflict The conflict's kind, or `null`; with a kind, both states are `Unmodified`.
   * @param submodule The submodule's status, or `null`.
   * @param indexCounts The index's line counts, or `null`.
   * @param worktreeCounts The worktree's line counts, or `null`.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When a path is empty, bytes aren't base64, the original path is present without a rename or copy or missing with one, or a conflict has a state other than `Unmodified`.
   * @example
   * ```ts
   * import { FileState, StatusEntry } from "@noldova/git.protocol";
   * export const entry: StatusEntry = new StatusEntry("new.txt", undefined, "old.txt", undefined, FileState.Renamed, FileState.Unmodified, null, null, null, null);
   * ```
   */
  public constructor(
    path: string,
    pathBytes: string | undefined,
    originalPath: string | null,
    originalPathBytes: string | undefined,
    index: FileState,
    worktree: FileState,
    conflict: ConflictKind | null,
    submodule: SubmoduleStatus | null,
    indexCounts: LineCounts | null,
    worktreeCounts: LineCounts | null,
    reader?: JsonReader);

  /**
   * Reads the entry from its JSON form, where the bytes fields may be missing.
   * @param value The parsed JSON value, untrusted.
   * @param path The entry's path in error messages; `$` by default.
   * @returns The entry.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   * @example
   * ```ts
   * import { StatusEntry } from "@noldova/git.protocol";
   * export const entry: StatusEntry = StatusEntry.fromJson({
   *   path: "a.txt",
   *   originalPath: null,
   *   index: "Unmodified",
   *   worktree: "Modified",
   *   conflict: null,
   *   submodule: null,
   *   indexCounts: null,
   *   worktreeCounts: { added: 2, removed: 1 }
   * });
   * ```
   */
  public static fromJson(value: unknown, path?: string): StatusEntry;

  /**
   * Writes the entry's JSON form, with the fields `path`, `pathBytes`, `originalPath`, `originalPathBytes`, `index`, `worktree`, `conflict`,
   * `submodule`, `indexCounts` and `worktreeCounts`; a bytes field appears only when it isn't `null`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { FileState, LineCounts, StatusEntry, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new StatusEntry("a.txt", undefined, null, undefined, FileState.Unmodified, FileState.Modified, null, null, null, new LineCounts(2, 1)).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A repository's local branches, the one checked out, and its remotes.
 * @example
 * ```ts
 * import type { GitBranches } from "@noldova/git.protocol";
 * export function others(branches: GitBranches): readonly string[] {
 *   return branches.branches.filter(t => t !== branches.current);
 * }
 * ```
 */
export declare class GitBranches {
  /**
   * The checked-out branch without `refs/heads/`, or `null` when HEAD is detached; untrusted.
   */
  public readonly current: string | null;

  /**
   * The local branches without `refs/heads/`, in git's order; empty before the first commit; untrusted.
   */
  public readonly branches: readonly string[];

  /**
   * The remotes' names, such as `origin`, in git's order; empty when the repository has none; untrusted.
   */
  public readonly remotes: readonly string[];

  /**
   * The remotes' branches, each `<remote>/<branch>` such as `origin/main`, in git's order; empty when there are none; untrusted.
   */
  public readonly remoteBranches: readonly string[];

  /**
   * Creates the branches.
   * @param current The checked-out branch, or `null`; not empty.
   * @param branches The local branches; none empty.
   * @param remotes The remotes' names; none empty.
   * @param remoteBranches The remotes' branches; each a name `git check-ref-format --branch` accepts, not starting with `-`.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the current branch, a branch or a remote is empty, or a remote branch is a name git refuses.
   * @example
   * ```ts
   * import { GitBranches } from "@noldova/git.protocol";
   * export const branches: GitBranches = new GitBranches("main", ["feature/view", "main"], ["origin"], ["origin/main"]);
   * ```
   */
  public constructor(current: string | null, branches: readonly string[], remotes: readonly string[], remoteBranches: readonly string[], reader?: JsonReader);

  /**
   * Reads the branches from their JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The branches' path in error messages; `$` by default.
   * @returns The branches.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, `branches` or `remotes` isn't an array of texts, or a branch or a remote is empty.
   * @example
   * ```ts
   * import { GitBranches } from "@noldova/git.protocol";
   * export const branches: GitBranches = GitBranches.fromJson({ current: null, branches: ["main"], remotes: ["origin"], remoteBranches: ["origin/main"] });
   * ```
   */
  public static fromJson(value: unknown, path?: string): GitBranches;

  /**
   * Writes the branches' JSON form, with the fields `current`, `branches`, `remotes` and `remoteBranches`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { GitBranches, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new GitBranches("main", ["main"], [], []).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The repository's own hooks that a write will run, so a view can name them before the person clicks.
 * @example
 * ```ts
 * import type { GitHooks } from "@noldova/git.protocol";
 * export function hint(hooks: GitHooks): string {
 *   return hooks.hooks.join(", ");
 * }
 * ```
 */
export declare class GitHooks {
  /**
   * The hooks' names, such as `post-merge`, in the order the write runs them; empty when none is installed; untrusted.
   */
  public readonly hooks: readonly string[];

  /**
   * Creates the hooks.
   * @param hooks The hooks' names; none empty.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When a name is empty.
   * @example
   * ```ts
   * import { GitHooks } from "@noldova/git.protocol";
   * export const hooks: GitHooks = new GitHooks(["post-merge"]);
   * ```
   */
  public constructor(hooks: readonly string[], reader?: JsonReader);

  /**
   * Reads the hooks from their JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The hooks' path in error messages; `$` by default.
   * @returns The hooks.
   * @throws {JsonException} When the value isn't an object, or `hooks` is missing; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or `hooks` isn't an array of texts that aren't empty.
   * @example
   * ```ts
   * import { GitHooks } from "@noldova/git.protocol";
   * export const hooks: GitHooks = GitHooks.fromJson({ hooks: ["post-merge"] });
   * ```
   */
  public static fromJson(value: unknown, path?: string): GitHooks;

  /**
   * Writes the hooks' JSON form, with the field `hooks`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { GitHooks, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new GitHooks([]).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The operation a worktree is in the middle of, such as a merge stopped for a conflict.
 * @example
 * ```ts
 * import type { GitOperation } from "@noldova/git.protocol";
 * export function describe(operation: GitOperation): string {
 *   return operation.from === null ? operation.kind : `${operation.kind} of ${operation.from}`;
 * }
 * ```
 */
export declare class GitOperation {
  /**
   * The operation's kind.
   */
  public readonly kind: OperationKind;

  /**
   * What the operation applies, such as the branch merged or the commit picked, or `null` when git doesn't record it; untrusted.
   */
  public readonly from: string | null;

  /**
   * The commit message git prepared for the operation, or `null` when it has none; untrusted.
   */
  public readonly message: string | null;

  /**
   * Creates the operation.
   * @param kind The operation's kind.
   * @param from What the operation applies, or `null`; not empty.
   * @param message The prepared message, or `null`; not empty.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When `from` or the message is empty.
   * @example
   * ```ts
   * import { GitOperation, OperationKind } from "@noldova/git.protocol";
   * export const operation: GitOperation = new GitOperation(OperationKind.Merge, "feature/view", "Merge branch 'feature/view'");
   * ```
   */
  public constructor(kind: OperationKind, from: string | null, message: string | null, reader?: JsonReader);

  /**
   * Reads the operation from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The operation's path in error messages; `$` by default.
   * @returns The operation.
   * @throws {JsonException} When the value isn't an object, a field is missing or of the wrong type, or the kind is unknown; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   * @example
   * ```ts
   * import { GitOperation } from "@noldova/git.protocol";
   * export const operation: GitOperation = GitOperation.fromJson({ kind: "Rebase", from: null, message: null });
   * ```
   */
  public static fromJson(value: unknown, path?: string): GitOperation;

  /**
   * Writes the operation's JSON form, with the fields `kind`, `from` and `message`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { GitOperation, OperationKind, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new GitOperation(OperationKind.Revert, null, null).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A remote of the repository: its name, and the host and repository path read from its URL.
 * @example
 * ```ts
 * import type { GitRemote } from "@noldova/git.protocol";
 * export function isOnHost(remote: GitRemote, host: string): boolean {
 *   return remote.host === host;
 * }
 * ```
 */
export declare class GitRemote {
  /**
   * The remote's name, such as `origin`; untrusted.
   */
  public readonly name: string;

  /**
   * The remote's host, such as `github.com`, or `null` when its URL names none; a bare host name, never holding `@`, `:`, `/`, `?`, `#` or a space,
   * so never a URL, userinfo, port or query; untrusted.
   */
  public readonly host: string | null;

  /**
   * The repository's path on the host without `.git`, such as `team/repo`, or `null` when its URL names none;
   * never holding `://`, `@`, `?` or `#`, never starting with `/`, and without an empty, `.` or `..` segment between `/` or `\` separators,
   * `%2e` counting as a dot, so never a URL, userinfo or query, and never a path that climbs out of the repository's place on the host; untrusted.
   */
  public readonly path: string | null;

  /**
   * How git reaches the remote.
   */
  public readonly transport: RemoteTransport;

  /**
   * Creates the remote.
   * @param name The remote's name; not empty.
   * @param host The host, or `null`; a bare host name, not empty.
   * @param path The repository's path on the host, or `null`; not empty, without a scheme, userinfo, a query, a fragment, a leading `/` or an empty, `.` or `..` segment.
   * @param transport How git reaches the remote.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the name is empty, the host is empty or holds `@`, `:`, `/`, `?`, `#` or a space,
   * or the path is empty, holds `://`, `@`, `?` or `#`, starts with `/`, or has an empty, `.` or `..` segment between `/` or `\` separators, `%2e` counting as a dot.
   * @example
   * ```ts
   * import { GitRemote, RemoteTransport } from "@noldova/git.protocol";
   * export const remote: GitRemote = new GitRemote("origin", "host.example", "team/repo", RemoteTransport.Https);
   * ```
   */
  public constructor(name: string, host: string | null, path: string | null, transport: RemoteTransport, reader?: JsonReader);

  /**
   * Reads the remote from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The remote's path in error messages; `$` by default.
   * @returns The remote.
   * @throws {JsonException} When the value isn't an object, a field is missing or of the wrong type, or the transport is unknown; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   * @example
   * ```ts
   * import { GitRemote } from "@noldova/git.protocol";
   * export const remote: GitRemote = GitRemote.fromJson({ name: "origin", host: "host.example", path: "team/repo", transport: "Ssh" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): GitRemote;

  /**
   * Writes the remote's JSON form, with the fields `name`, `host`, `path` and `transport`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { GitRemote, RemoteTransport, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new GitRemote("backup", null, null, RemoteTransport.File).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The Git module's reads that another module's runtime part uses, such as a host module's agent tools: the Git runtime part publishes one as
 * `git.repositories`, and a module that declares `git` among its dependencies gets it with `context.getService`. It only reads.
 * @example
 * ```ts
 * import { GitNames, GitRepositories, type GitStatus } from "@noldova/git.protocol";
 * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
 *
 * export function readAsync(context: IRuntimePartContext, folder: string, signal: AbortSignal): Promise<GitStatus> {
 *   return context.getService(GitNames.repositoriesService, GitRepositories).readStatusAsync(folder, signal);
 * }
 * ```
 */
export declare abstract class GitRepositories {
  /**
   * Reads the status of the repository that holds a folder, as `git.status` does: through the person's own git with its fsmonitor off, one
   * read at a time per repository.
   * @param folder The folder; absolute, at most 4096 characters, untrusted.
   * @param signal Stops the read, which then rejects with the signal's reason.
   * @returns The status of the folder's worktree.
   * @throws {MethodFailureException} As `git.status` answers: refused parameters as `InvalidParams`, a folder outside a repository as
   * `NotFound`, a missing or older git as `Unavailable` and any other failure of git as `Internal`, each with a `GitFailure` in its details;
   * it comes from `@noldova/desktop.runtime`.
   * @example
   * ```ts
   * import type { GitRepositories, GitStatus } from "@noldova/git.protocol";
   *
   * export function branchOfAsync(repositories: GitRepositories, folder: string): Promise<string | null> {
   *   return repositories.readStatusAsync(folder, new AbortController().signal).then((t: GitStatus) => t.branch);
   * }
   * ```
   */
  public abstract readStatusAsync(folder: string, signal: AbortSignal): Promise<GitStatus>;

  /**
   * Reads one remote of the repository that holds a folder by its name, such as `origin`, whatever remote the branch works with.
   * @param folder The folder; absolute, at most 4096 characters, untrusted.
   * @param name The remote's name, matched exactly.
   * @param signal Stops the read, which then rejects with the signal's reason.
   * @returns The remote, or `null` when the repository has none of that name or git's configuration can't be read in full.
   * @throws {MethodFailureException} As {@link readStatusAsync} does.
   * @example
   * ```ts
   * import type { GitRemote, GitRepositories } from "@noldova/git.protocol";
   *
   * export function originOfAsync(repositories: GitRepositories, folder: string): Promise<GitRemote | null> {
   *   return repositories.readRemoteAsync(folder, "origin", new AbortController().signal);
   * }
   * ```
   */
  public abstract readRemoteAsync(folder: string, name: string, signal: AbortSignal): Promise<GitRemote | null>;
}

/**
 * A worktree's status: its branch, HEAD, upstream, changed paths, the operation in progress and its remote.
 * @example
 * ```ts
 * import type { GitStatus } from "@noldova/git.protocol";
 * export function isClean(status: GitStatus): boolean {
 *   return status.entries.length === 0 && !status.truncated;
 * }
 * ```
 */
export declare class GitStatus {
  /**
   * The checked-out branch without `refs/heads/`, or `null` when HEAD is detached; untrusted.
   */
  public readonly branch: string | null;

  /**
   * HEAD's full commit id, or `null` before the first commit.
   */
  public readonly head: string | null;

  /**
   * The branch's upstream, or `null` when it has none.
   */
  public readonly upstream: StatusUpstream | null;

  /**
   * The changed paths, in git's order.
   */
  public readonly entries: readonly StatusEntry[];

  /**
   * Whether more paths changed than `entries` holds.
   */
  public readonly truncated: boolean;

  /**
   * What the runtime read the status from, which changes when HEAD, the index or a changed path does; a write takes the fingerprint its caller
   * showed and fails as `Stale` when it has moved.
   */
  public readonly fingerprint: string;

  /**
   * The merge, rebase, cherry-pick or revert the worktree is in the middle of, or `null` when there is none.
   */
  public readonly operation: GitOperation | null;

  /**
   * The remote the branch works with, or `null` when the repository has none or the runtime can't tell which.
   */
  public readonly remote: GitRemote | null;

  /**
   * Creates the status.
   * @param branch The branch, or `null`; not empty.
   * @param head HEAD's full id, or `null`.
   * @param upstream The upstream, or `null`.
   * @param entries The changed paths.
   * @param truncated Whether paths were left out.
   * @param fingerprint What the status was read from; not empty.
   * @param operation The operation in progress, or `null`.
   * @param remote The remote, or `null`.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the branch or the fingerprint is empty, or HEAD isn't a full object id.
   * @example
   * ```ts
   * import { GitStatus } from "@noldova/git.protocol";
   * export const status: GitStatus = new GitStatus("main", "0123456789abcdef0123456789abcdef01234567", null, [], false, "4f2a", null, null);
   * ```
   */
  public constructor(
    branch: string | null,
    head: string | null,
    upstream: StatusUpstream | null,
    entries: readonly StatusEntry[],
    truncated: boolean,
    fingerprint: string,
    operation: GitOperation | null,
    remote: GitRemote | null,
    reader?: JsonReader);

  /**
   * Reads the status from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The status's path in error messages; `$` by default.
   * @returns The status.
   * @throws {JsonException} When the value isn't an object, or a field, or a field of an entry, the upstream, the operation or the remote is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value, or a field of an entry, the upstream, the operation or the remote is invalid.
   * @example
   * ```ts
   * import { GitStatus } from "@noldova/git.protocol";
   * export function readStatus(text: string): GitStatus {
   *   return GitStatus.fromJson(JSON.parse(text));
   * }
   * ```
   */
  public static fromJson(value: unknown, path?: string): GitStatus;

  /**
   * Writes the status's JSON form, with the fields `branch`, `head`, `upstream`, `entries`, `truncated`, `fingerprint`, `operation` and `remote`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { GitStatus, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new GitStatus(null, null, null, [], false, "4f2a", null, null).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * What a diff compares: the worktree, the staged changes, or a range of two revisions.
 * @example
 * ```ts
 * import { DiffScope, DiffScopeKind } from "@noldova/git.protocol";
 * export const staged: DiffScope = new DiffScope(DiffScopeKind.Staged);
 * ```
 */
export declare class DiffScope {
  /**
   * The scope's kind.
   */
  public readonly kind: DiffScopeKind;

  /**
   * The revision compared from, exactly when the kind is `Range`; otherwise absent, and left out of the JSON form; untrusted.
   */
  public readonly from: string | undefined;

  /**
   * The revision compared to, exactly when the kind is `Range`; otherwise absent, and left out of the JSON form; untrusted.
   */
  public readonly to: string | undefined;

  /**
   * Creates the scope.
   * @param kind The scope's kind.
   * @param from The revision compared from, only for a range, and left out otherwise; not empty, without a NUL character.
   * @param to The revision compared to, only for a range, and left out otherwise; not empty, without a NUL character.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When a range lacks a revision or has an empty one or one with a NUL character, or another kind has one.
   * @example
   * ```ts
   * import { DiffScope, DiffScopeKind } from "@noldova/git.protocol";
   * export const range: DiffScope = new DiffScope(DiffScopeKind.Range, "main", "feature/login");
   * ```
   */
  public constructor(kind: DiffScopeKind, from?: string, to?: string, reader?: JsonReader);

  /**
   * Reads the scope from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The scope's path in error messages; `$` by default.
   * @returns The scope.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   * @example
   * ```ts
   * import { DiffScope } from "@noldova/git.protocol";
   * export const scope: DiffScope = DiffScope.fromJson({ kind: "Worktree" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): DiffScope;

  /**
   * Writes the scope's JSON form, with the field `kind`, and `from` and `to` for a range.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { DiffScope, DiffScopeKind, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new DiffScope(DiffScopeKind.Worktree).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * One line of a diff hunk.
 * @example
 * ```ts
 * import { DiffLine, LineKind } from "@noldova/git.protocol";
 * export const line: DiffLine = new DiffLine(LineKind.Added, null, 12, "return true;");
 * ```
 */
export declare class DiffLine {
  /**
   * The line's kind.
   */
  public readonly kind: LineKind;

  /**
   * The line's number in the old file, for a context or removed line; otherwise `null`.
   */
  public readonly oldNumber: number | null;

  /**
   * The line's number in the new file, for a context or added line; otherwise `null`.
   */
  public readonly newNumber: number | null;

  /**
   * The line's text without its sign or newline, with a carriage return kept; untrusted.
   */
  public readonly text: string;

  /**
   * Creates the line.
   * @param kind The line's kind.
   * @param oldNumber The old number above zero, or `null`, as the kind requires.
   * @param newNumber The new number above zero, or `null`, as the kind requires.
   * @param text The line's text.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When a number is missing where the kind needs it, present where it doesn't, or not a whole number above zero.
   * @example
   * ```ts
   * import { DiffLine, LineKind } from "@noldova/git.protocol";
   * export const context: DiffLine = new DiffLine(LineKind.Context, 3, 4, "}");
   * ```
   */
  public constructor(kind: LineKind, oldNumber: number | null, newNumber: number | null, text: string, reader?: JsonReader);

  /**
   * Reads the line from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The line's path in error messages; `$` by default.
   * @returns The line.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   * @example
   * ```ts
   * import { DiffLine } from "@noldova/git.protocol";
   * export const line: DiffLine = DiffLine.fromJson({ kind: "Removed", oldNumber: 7, newNumber: null, text: "old" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): DiffLine;

  /**
   * Writes the line's JSON form, with the fields `kind`, `oldNumber`, `newNumber` and `text`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { DiffLine, LineKind, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new DiffLine(LineKind.NoNewlineAtEnd, null, null, "").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * One hunk of a file's diff, with its ranges as git's `@@` header gives them.
 * @example
 * ```ts
 * import type { DiffHunk } from "@noldova/git.protocol";
 * export function describe(hunk: DiffHunk): string {
 *   return `-${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount}`;
 * }
 * ```
 */
export declare class DiffHunk {
  /**
   * The first old line's number, or 0 when the old range is empty.
   */
  public readonly oldStart: number;

  /**
   * How many old lines the hunk spans.
   */
  public readonly oldCount: number;

  /**
   * The first new line's number, or 0 when the new range is empty.
   */
  public readonly newStart: number;

  /**
   * How many new lines the hunk spans.
   */
  public readonly newCount: number;

  /**
   * The text after the `@@` header's ranges, such as a function's name; may be empty; untrusted.
   */
  public readonly header: string;

  /**
   * The hunk's lines, in order.
   */
  public readonly lines: readonly DiffLine[];

  /**
   * Creates the hunk.
   * @param oldStart The old start; zero or more.
   * @param oldCount The old count; zero or more.
   * @param newStart The new start; zero or more.
   * @param newCount The new count; zero or more.
   * @param header The header's text.
   * @param lines The lines.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When a start or count isn't a whole number of zero or more.
   * @example
   * ```ts
   * import { DiffHunk, DiffLine, LineKind } from "@noldova/git.protocol";
   * export const hunk: DiffHunk = new DiffHunk(0, 0, 1, 1, "", [new DiffLine(LineKind.Added, null, 1, "first")]);
   * ```
   */
  public constructor(oldStart: number, oldCount: number, newStart: number, newCount: number, header: string, lines: readonly DiffLine[], reader?: JsonReader);

  /**
   * Reads the hunk from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The hunk's path in error messages; `$` by default.
   * @returns The hunk.
   * @throws {JsonException} When the value isn't an object, or a field, or a field of a line is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value, or a field of a line is invalid.
   * @example
   * ```ts
   * import { DiffHunk } from "@noldova/git.protocol";
   * export const hunk: DiffHunk = DiffHunk.fromJson({ oldStart: 1, oldCount: 0, newStart: 1, newCount: 0, header: "", lines: [] });
   * ```
   */
  public static fromJson(value: unknown, path?: string): DiffHunk;

  /**
   * Writes the hunk's JSON form, with the fields `oldStart`, `oldCount`, `newStart`, `newCount`, `header` and `lines`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { DiffHunk, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new DiffHunk(1, 0, 1, 0, "", []).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A submodule's change in a diff: the commit it pointed to before and after.
 * @example
 * ```ts
 * import { SubmoduleChange } from "@noldova/git.protocol";
 * export const added: SubmoduleChange = new SubmoduleChange(null, "0123456789abcdef0123456789abcdef01234567");
 * ```
 */
export declare class SubmoduleChange {
  /**
   * The old commit's full id, or `null` when the submodule was added.
   */
  public readonly oldCommit: string | null;

  /**
   * The new commit's full id, or `null` when the submodule was removed.
   */
  public readonly newCommit: string | null;

  /**
   * Creates the change.
   * @param oldCommit The old commit's full id, or `null`.
   * @param newCommit The new commit's full id, or `null`.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When both are `null`, or one isn't a full object id.
   * @example
   * ```ts
   * import { SubmoduleChange } from "@noldova/git.protocol";
   * export const removed: SubmoduleChange = new SubmoduleChange("0123456789abcdef0123456789abcdef01234567", null);
   * ```
   */
  public constructor(oldCommit: string | null, newCommit: string | null, reader?: JsonReader);

  /**
   * Reads the change from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The change's path in error messages; `$` by default.
   * @returns The change.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   * @example
   * ```ts
   * import { SubmoduleChange } from "@noldova/git.protocol";
   * export const change: SubmoduleChange = SubmoduleChange.fromJson({ oldCommit: null, newCommit: "0123456789abcdef0123456789abcdef01234567" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): SubmoduleChange;

  /**
   * Writes the change's JSON form, with the fields `oldCommit` and `newCommit`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { SubmoduleChange, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new SubmoduleChange(null, "0123456789abcdef0123456789abcdef01234567").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * One file's diff: its paths, how it changed, its modes and its hunks.
 * @example
 * ```ts
 * import { LineKind, type DiffFile } from "@noldova/git.protocol";
 * export function countAdded(file: DiffFile): number {
 *   return file.hunks.flatMap(t => t.lines).filter(t => t.kind === LineKind.Added).length;
 * }
 * ```
 */
export declare class DiffFile {
  /**
   * The new path, relative to the worktree's root with `/`; untrusted.
   */
  public readonly path: string;

  /**
   * The new path's bytes in base64, only when they aren't valid UTF-8; otherwise absent, and left out of the JSON form.
   */
  public readonly pathBytes: string | undefined;

  /**
   * The old path; always present, and the same as `path` unless the file was renamed or copied; untrusted.
   */
  public readonly oldPath: string;

  /**
   * The old path's bytes in base64, only when they aren't valid UTF-8; otherwise absent, and left out of the JSON form.
   */
  public readonly oldPathBytes: string | undefined;

  /**
   * How the file changed.
   */
  public readonly change: FileChange;

  /**
   * The old mode as six octal digits, or `null` for an added file.
   */
  public readonly oldMode: string | null;

  /**
   * The new mode as six octal digits, or `null` for a deleted file.
   */
  public readonly newMode: string | null;

  /**
   * Whether git treats the file as binary; a binary file has no hunks.
   */
  public readonly binary: boolean;

  /**
   * The submodule's change, or `null` when the path isn't a submodule.
   */
  public readonly submodule: SubmoduleChange | null;

  /**
   * The hunks, in order.
   */
  public readonly hunks: readonly DiffHunk[];

  /**
   * Whether the file's hunks were cut to fit the diff's budget.
   */
  public readonly truncated: boolean;

  /**
   * Creates the file's diff.
   * @param path The new path; not empty.
   * @param pathBytes The new path's bytes in base64, or `undefined`.
   * @param oldPath The old path; not empty, and the same as `path` with the same bytes unless the change is `Renamed` or `Copied`.
   * @param oldPathBytes The old path's bytes in base64, or `undefined`.
   * @param change How the file changed.
   * @param oldMode The old mode, or `null`; always `null` for an added file.
   * @param newMode The new mode, or `null`; always `null` for a deleted file.
   * @param binary Whether the file is binary.
   * @param submodule The submodule's change, or `null`.
   * @param hunks The hunks; none for a binary file.
   * @param truncated Whether hunks were cut.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When a path is empty, bytes aren't base64, a mode isn't six octal digits or is present where the change rules it out, the old path differs from the path without a rename or copy, or a binary file has hunks.
   * @example
   * ```ts
   * import { DiffFile, FileChange } from "@noldova/git.protocol";
   * export const file: DiffFile = new DiffFile("a.txt", undefined, "a.txt", undefined, FileChange.Modified, "100644", "100644", false, null, [], false);
   * ```
   */
  public constructor(
    path: string,
    pathBytes: string | undefined,
    oldPath: string,
    oldPathBytes: string | undefined,
    change: FileChange,
    oldMode: string | null,
    newMode: string | null,
    binary: boolean,
    submodule: SubmoduleChange | null,
    hunks: readonly DiffHunk[],
    truncated: boolean,
    reader?: JsonReader);

  /**
   * Reads the file's diff from its JSON form, where the bytes fields may be missing.
   * @param value The parsed JSON value, untrusted.
   * @param path The file's path in error messages; `$` by default.
   * @returns The file's diff.
   * @throws {JsonException} When the value isn't an object, or a field, or a field of a hunk or the submodule is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value, or a field of a hunk or the submodule is invalid.
   * @example
   * ```ts
   * import { DiffFile } from "@noldova/git.protocol";
   * export function readFile(text: string): DiffFile {
   *   return DiffFile.fromJson(JSON.parse(text));
   * }
   * ```
   */
  public static fromJson(value: unknown, path?: string): DiffFile;

  /**
   * Writes the file's JSON form; a bytes field appears only when it isn't `null`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { DiffFile, FileChange, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new DiffFile("a.txt", undefined, "a.txt", undefined, FileChange.Deleted, "100644", null, false, null, [], false).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A diff within its budget: the files, their size, and how many were left out.
 * @example
 * ```ts
 * import type { GitDiff } from "@noldova/git.protocol";
 * export function describe(diff: GitDiff): string {
 *   return diff.omittedFiles > 0 ? `${diff.files.length} files, ${diff.omittedFiles} more not shown` : `${diff.files.length} files`;
 * }
 * ```
 */
export declare class GitDiff {
  /**
   * The files, in git's order.
   */
  public readonly files: readonly DiffFile[];

  /**
   * The size in bytes of git's output for the files shown.
   */
  public readonly totalBytes: number;

  /**
   * How many whole files were left out once the budget ran out.
   */
  public readonly omittedFiles: number;

  /**
   * Whether anything was left out: a whole file, or a file's hunks.
   */
  public readonly truncated: boolean;

  /**
   * Creates the diff.
   * @param files The files.
   * @param totalBytes The bytes shown; zero or more.
   * @param omittedFiles The files left out; zero or more.
   * @param truncated Whether anything was left out; `true` whenever files were.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When a count isn't a whole number of zero or more, or files were left out without `truncated`.
   * @example
   * ```ts
   * import { GitDiff } from "@noldova/git.protocol";
   * export const empty: GitDiff = new GitDiff([], 0, 0, false);
   * ```
   */
  public constructor(files: readonly DiffFile[], totalBytes: number, omittedFiles: number, truncated: boolean, reader?: JsonReader);

  /**
   * Reads the diff from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The diff's path in error messages; `$` by default.
   * @returns The diff.
   * @throws {JsonException} When the value isn't an object, or a field, or a field of a file is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value, or a field of a file is invalid.
   * @example
   * ```ts
   * import { GitDiff } from "@noldova/git.protocol";
   * export function readDiff(text: string): GitDiff {
   *   return GitDiff.fromJson(JSON.parse(text));
   * }
   * ```
   */
  public static fromJson(value: unknown, path?: string): GitDiff;

  /**
   * Writes the diff's JSON form, with the fields `files`, `totalBytes`, `omittedFiles` and `truncated`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { GitDiff, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new GitDiff([], 0, 0, false).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * What a failed call's details carry: the shared failure code, git's own code when git failed, and a message; the runtime puts it in
 * Noldova Desktop's failure details.
 * @example
 * ```ts
 * import { GitCode, type GitFailure } from "@noldova/git.protocol";
 * export function needsPull(failure: GitFailure): boolean {
 *   return failure.gitCode === GitCode.PushRejected;
 * }
 * ```
 */
export declare class GitFailure {
  /**
   * The shared failure code.
   */
  public readonly code: FailureCode;

  /**
   * Git's own code, or `null` when the failure didn't come from git.
   */
  public readonly gitCode: GitCode | null;

  /**
   * What failed, for the person; it may quote git's output, so it is untrusted.
   */
  public readonly message: string;

  /**
   * The version of the git that is too old, such as `2.34.1`, with `GitCode.GitTooOld`; otherwise, or when git didn't say, `null`.
   */
  public readonly gitVersion: string | null;

  /**
   * Creates the failure.
   * @param code The shared failure code.
   * @param gitCode Git's own code, or `null`.
   * @param message What failed; not empty.
   * @param gitVersion The version of the git that is too old, only with `GitCode.GitTooOld`, or `null`.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the message is empty, or a version comes with another git code or isn't a version.
   * @example
   * ```ts
   * import { FailureCode, GitCode, GitFailure } from "@noldova/git.protocol";
   * export const failure: GitFailure = new GitFailure(FailureCode.Git, GitCode.IndexLocked, "Another git process holds the index.", null);
   * ```
   */
  public constructor(code: FailureCode, gitCode: GitCode | null, message: string, gitVersion: string | null, reader?: JsonReader);

  /**
   * Reads the failure from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The failure's path in error messages; `$` by default.
   * @returns The failure.
   * @throws {JsonException} When the value isn't an object, a field is missing or of the wrong type, or a code is unknown; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, the message is empty, or the version comes with another git code or isn't a version.
   * @example
   * ```ts
   * import { GitFailure } from "@noldova/git.protocol";
   * export const failure: GitFailure = GitFailure.fromJson({ code: "Stale", gitCode: null, message: "The status changed.", gitVersion: null });
   * ```
   */
  public static fromJson(value: unknown, path?: string): GitFailure;

  /**
   * Writes the failure's JSON form, with the fields `code`, `gitCode`, `message` and `gitVersion`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { FailureCode, GitFailure, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new GitFailure(FailureCode.Refused, null, "The folder isn't absolute.", null).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The folder an app binds to an agent session as `git.folder`, which the Git and host modules' agent tools act in; the app sets it when it
 * opens the session, and a tool never takes it from its arguments.
 * @example
 * ```ts
 * import { GitFolderBinding } from "@noldova/git.protocol";
 * export const binding: GitFolderBinding = new GitFolderBinding("/home/a/repo");
 * ```
 */
export declare class GitFolderBinding {
  /**
   * The session's folder, an absolute POSIX, drive or UNC path of at most 4096 characters.
   */
  public readonly folder: string;

  /**
   * Creates the binding.
   * @param folder The folder; absolute, at most 4096 characters.
   * @param reader The reader the value came from, so an error names the binding by its path; omitted for a value that didn't come from JSON.
   * @throws {ProtocolFieldException} When the folder isn't absolute or is longer than 4096 characters.
   * @example
   * ```ts
   * import { GitFolderBinding } from "@noldova/git.protocol";
   * export const binding: GitFolderBinding = new GitFolderBinding("C:\\work\\repo");
   * ```
   */
  public constructor(folder: string, reader?: JsonReader);

  /**
   * Reads the binding from a session's bindings, which may hold other modules' bindings too.
   * @param bindings The session's bindings, such as a tool call's `bindings`.
   * @param path The bindings' path in error messages; `$` by default.
   * @returns The binding.
   * @throws {JsonException} When the bindings aren't an object, or `git.folder` is missing or not a text; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the folder is invalid.
   * @example
   * ```ts
   * import { GitFolderBinding } from "@noldova/git.protocol";
   * export const folder: string = GitFolderBinding.fromBindings({ "git.folder": "/home/a/repo" }).folder;
   * ```
   */
  public static fromBindings(bindings: unknown, path?: string): GitFolderBinding;

  /**
   * Writes the binding as the app passes it to `openSession`, with the field `git.folder`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { GitFolderBinding, type JsonObject } from "@noldova/git.protocol";
   * export const bindings: JsonObject = new GitFolderBinding("/home/a/repo").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of a call that names only a folder: `git.status`, `git.branches`, `git.worktrees`, `git.watch` and `git.unwatch`.
 * @example
 * ```ts
 * import { GitFolderParams } from "@noldova/git.protocol";
 * export const params: GitFolderParams = new GitFolderParams("/home/a/repo");
 * ```
 */
export declare class GitFolderParams {
  /**
   * The repository's folder, an absolute POSIX, drive or UNC path of at most 4096 characters; untrusted.
   */
  public readonly folder: string;

  /**
   * Creates the parameters.
   * @param folder The folder; absolute, at most 4096 characters.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the folder isn't absolute or is longer than 4096 characters.
   * @example
   * ```ts
   * import { GitFolderParams } from "@noldova/git.protocol";
   * export const params: GitFolderParams = new GitFolderParams("C:\\work\\repo");
   * ```
   */
  public constructor(folder: string, reader?: JsonReader);

  /**
   * Reads the parameters from their JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The parameters' path in error messages; `$` by default.
   * @returns The parameters.
   * @throws {JsonException} When the value isn't an object, or the folder is missing or not a text; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or the folder is invalid.
   * @example
   * ```ts
   * import { GitFolderParams } from "@noldova/git.protocol";
   * export const params: GitFolderParams = GitFolderParams.fromJson({ folder: "/home/a/repo" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): GitFolderParams;

  /**
   * Writes the parameters' JSON form, with the field `folder`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { GitFolderParams, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new GitFolderParams("/home/a/repo").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of `git.diff`: the folder and what the diff compares.
 * @example
 * ```ts
 * import { DiffScope, DiffScopeKind, GitDiffParams } from "@noldova/git.protocol";
 * export const params: GitDiffParams = new GitDiffParams("/home/a/repo", new DiffScope(DiffScopeKind.Staged));
 * ```
 */
export declare class GitDiffParams {
  /**
   * The repository's folder, an absolute POSIX, drive or UNC path of at most 4096 characters; untrusted.
   */
  public readonly folder: string;

  /**
   * What the diff compares.
   */
  public readonly scope: DiffScope;

  /**
   * Creates the parameters.
   * @param folder The folder; absolute, at most 4096 characters.
   * @param scope What the diff compares.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the folder isn't absolute or is longer than 4096 characters.
   * @example
   * ```ts
   * import { DiffScope, DiffScopeKind, GitDiffParams } from "@noldova/git.protocol";
   * export const params: GitDiffParams = new GitDiffParams("/home/a/repo", new DiffScope(DiffScopeKind.Range, "main", "HEAD"));
   * ```
   */
  public constructor(folder: string, scope: DiffScope, reader?: JsonReader);

  /**
   * Reads the parameters from their JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The parameters' path in error messages; `$` by default.
   * @returns The parameters.
   * @throws {JsonException} When the value isn't an object, the scope isn't an object, or a field or a field of the scope is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value or the scope holds an unknown field, or a field's value or a field of the scope is invalid.
   * @example
   * ```ts
   * import { GitDiffParams } from "@noldova/git.protocol";
   * export const params: GitDiffParams = GitDiffParams.fromJson({ folder: "/home/a/repo", scope: { kind: "Worktree" } });
   * ```
   */
  public static fromJson(value: unknown, path?: string): GitDiffParams;

  /**
   * Writes the parameters' JSON form, with the fields `folder` and `scope`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { DiffScope, DiffScopeKind, GitDiffParams, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new GitDiffParams("/home/a/repo", new DiffScope(DiffScopeKind.Worktree)).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The paths a diff is limited to, such as an agent tool's, each relative to the repository's top folder by the same rule as
 * {@link GitPathsParams.paths}; none for every file.
 * @example
 * ```ts
 * import { GitDiffPaths } from "@noldova/git.protocol";
 * export const paths: readonly string[] = new GitDiffPaths(["src/a.ts"]).paths;
 * ```
 */
export declare class GitDiffPaths {
  /**
   * The paths, 0 to 10000, each relative to the repository's top folder by the rule {@link GitPathsParams.paths} gives; untrusted.
   */
  public readonly paths: readonly string[];

  /**
   * Checks the paths.
   * @param paths The paths; 0 to 10000, each relative to the repository's top folder.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When there are more than 10000 paths, or a path is empty, absolute, too long, starts with a drive letter and a
   * colon, with a colon or with a backslash, or holds a `..` segment or a NUL character.
   * @example
   * ```ts
   * import { GitDiffPaths } from "@noldova/git.protocol";
   * export const all: GitDiffPaths = new GitDiffPaths([]);
   * ```
   */
  public constructor(paths: readonly string[], reader?: JsonReader);
}

/**
 * The parameters of `git.stage` and `git.unstage`: the folder, the paths and the status they are based on.
 * @example
 * ```ts
 * import { GitPathsParams, type GitStatus } from "@noldova/git.protocol";
 * export function stageAll(folder: string, status: GitStatus): GitPathsParams {
 *   return new GitPathsParams(folder, status.entries.map(t => t.path), status.fingerprint);
 * }
 * ```
 */
export declare class GitPathsParams {
  /**
   * The repository's folder, an absolute POSIX, drive or UNC path of at most 4096 characters; untrusted.
   */
  public readonly folder: string;

  /**
   * The paths, 1 to 10000, each relative to the folder with `/` or `\`, 1 to 4096 characters,
   * not starting with a drive letter and a colon, which Windows reads as drive-relative, with a colon, which git reads as pathspec magic, or with a backslash,
   * which Windows reads as rooted,
   * so a file at the repository's root whose name is a letter and a colon, such as `a:b`, which Linux and macOS allow, can't be staged or unstaged,
   * without a `..` segment or a NUL character; untrusted.
   */
  public readonly paths: readonly string[];

  /**
   * The fingerprint of the status the caller showed; the call fails as `Stale` when it has moved.
   */
  public readonly basedOn: string;

  /**
   * Creates the parameters.
   * @param folder The folder; absolute, at most 4096 characters.
   * @param paths The paths; 1 to 10000, each relative to the folder.
   * @param basedOn The status's fingerprint; not empty.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the folder isn't absolute or is too long, there are no paths or more than 10000, a path is empty, absolute,
   * too long, starts with a drive letter and a colon, with a colon or with a backslash, or holds a `..` segment or a NUL character, or the fingerprint is empty.
   * @example
   * ```ts
   * import { GitPathsParams } from "@noldova/git.protocol";
   * export const params: GitPathsParams = new GitPathsParams("/home/a/repo", ["src/a.ts"], "4f2a");
   * ```
   */
  public constructor(folder: string, paths: readonly string[], basedOn: string, reader?: JsonReader);

  /**
   * Reads the parameters from their JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The parameters' path in error messages; `$` by default.
   * @returns The parameters.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, `paths` isn't an array of texts, or a field's value is invalid.
   * @example
   * ```ts
   * import { GitPathsParams } from "@noldova/git.protocol";
   * export const params: GitPathsParams = GitPathsParams.fromJson({ folder: "/home/a/repo", paths: ["a.txt"], basedOn: "4f2a" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): GitPathsParams;

  /**
   * Writes the parameters' JSON form, with the fields `folder`, `paths` and `basedOn`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { GitPathsParams, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new GitPathsParams("/home/a/repo", ["a.txt"], "4f2a").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of `git.createBranch` and `git.switchBranch`: the folder, the branch and the status they are based on.
 * @example
 * ```ts
 * import { GitBranchParams } from "@noldova/git.protocol";
 * export const params: GitBranchParams = new GitBranchParams("/home/a/repo", "feature/view", "4f2a");
 * ```
 */
export declare class GitBranchParams {
  /**
   * The repository's folder, an absolute POSIX, drive or UNC path of at most 4096 characters; untrusted.
   */
  public readonly folder: string;

  /**
   * The branch's name without `refs/heads/`, one `git check-ref-format --branch` accepts: 1 to 255 characters, not starting with `-`, so git never
   * reads it as an option, not `@` or `HEAD` alone and not ending with `.`, without `..`, `@{`, a space, a control character or any of `~^:?*[\`, and with no
   * segment between slashes that is empty, starts with `.` or ends with `.lock`; untrusted.
   */
  public readonly name: string;

  /**
   * The fingerprint of the status the caller showed; the call fails as `Stale` when it has moved.
   */
  public readonly basedOn: string;

  /**
   * Creates the parameters.
   * @param folder The folder; absolute, at most 4096 characters.
   * @param name The branch's name; one git accepts, 1 to 255 characters, not starting with `-`.
   * @param basedOn The status's fingerprint; not empty.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the folder isn't absolute or is too long, the name is one
   * `git check-ref-format --branch` refuses, starts with `-` or is longer than 255 characters, or the fingerprint is empty.
   * @example
   * ```ts
   * import { GitBranchParams } from "@noldova/git.protocol";
   * export const params: GitBranchParams = new GitBranchParams("C:\\work\\repo", "main", "4f2a");
   * ```
   */
  public constructor(folder: string, name: string, basedOn: string, reader?: JsonReader);

  /**
   * Reads the parameters from their JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The parameters' path in error messages; `$` by default.
   * @returns The parameters.
   * @throws {JsonException} When the value isn't an object, or a field is missing or not a text; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   * @example
   * ```ts
   * import { GitBranchParams } from "@noldova/git.protocol";
   * export const params: GitBranchParams = GitBranchParams.fromJson({ folder: "/home/a/repo", name: "main", basedOn: "4f2a" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): GitBranchParams;

  /**
   * Writes the parameters' JSON form, with the fields `folder`, `name` and `basedOn`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { GitBranchParams, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new GitBranchParams("/home/a/repo", "main", "4f2a").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of `git.commit`: the folder, the message and the status it is based on.
 * @example
 * ```ts
 * import { GitCommitParams } from "@noldova/git.protocol";
 * export const params: GitCommitParams = new GitCommitParams("/home/a/repo", "Add the status view", "4f2a");
 * ```
 */
export declare class GitCommitParams {
  /**
   * The repository's folder, an absolute POSIX, drive or UNC path of at most 4096 characters; untrusted.
   */
  public readonly folder: string;

  /**
   * The commit message; untrusted.
   */
  public readonly message: string;

  /**
   * The fingerprint of the status the caller showed; the call fails as `Stale` when it has moved.
   */
  public readonly basedOn: string;

  /**
   * Creates the parameters.
   * @param folder The folder; absolute, at most 4096 characters.
   * @param message The commit message; not empty, without a NUL character.
   * @param basedOn The status's fingerprint; not empty.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the folder isn't absolute or is too long, the message is empty or holds a NUL character, or the fingerprint is empty.
   * @example
   * ```ts
   * import { GitCommitParams } from "@noldova/git.protocol";
   * export const params: GitCommitParams = new GitCommitParams("C:\\work\\repo", "Fix the header", "4f2a");
   * ```
   */
  public constructor(folder: string, message: string, basedOn: string, reader?: JsonReader);

  /**
   * Reads the parameters from their JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The parameters' path in error messages; `$` by default.
   * @returns The parameters.
   * @throws {JsonException} When the value isn't an object, or a field is missing or not a text; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   * @example
   * ```ts
   * import { GitCommitParams } from "@noldova/git.protocol";
   * export const params: GitCommitParams = GitCommitParams.fromJson({ folder: "/home/a/repo", message: "Fix the header", basedOn: "4f2a" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): GitCommitParams;

  /**
   * Writes the parameters' JSON form, with the fields `folder`, `message` and `basedOn`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { GitCommitParams, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new GitCommitParams("/home/a/repo", "Fix the header", "4f2a").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of `git.pull`: the folder and the status it is based on.
 * @example
 * ```ts
 * import { GitPullParams } from "@noldova/git.protocol";
 * export const params: GitPullParams = new GitPullParams("/home/a/repo", "4f2a");
 * ```
 */
export declare class GitPullParams {
  /**
   * The repository's folder, an absolute POSIX, drive or UNC path of at most 4096 characters; untrusted.
   */
  public readonly folder: string;

  /**
   * The fingerprint of the status the caller showed; the call fails as `Stale` when it has moved.
   */
  public readonly basedOn: string;

  /**
   * Creates the parameters.
   * @param folder The folder; absolute, at most 4096 characters.
   * @param basedOn The status's fingerprint; not empty.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the folder isn't absolute or is too long, or the fingerprint is empty.
   * @example
   * ```ts
   * import { GitPullParams } from "@noldova/git.protocol";
   * export const params: GitPullParams = new GitPullParams("C:\\work\\repo", "4f2a");
   * ```
   */
  public constructor(folder: string, basedOn: string, reader?: JsonReader);

  /**
   * Reads the parameters from their JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The parameters' path in error messages; `$` by default.
   * @returns The parameters.
   * @throws {JsonException} When the value isn't an object, or a field is missing or not a text; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   * @example
   * ```ts
   * import { GitPullParams } from "@noldova/git.protocol";
   * export const params: GitPullParams = GitPullParams.fromJson({ folder: "/home/a/repo", basedOn: "4f2a" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): GitPullParams;

  /**
   * Writes the parameters' JSON form, with the fields `folder` and `basedOn`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { GitPullParams, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new GitPullParams("/home/a/repo", "4f2a").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of `git.push`: the folder and the status it is based on.
 * @example
 * ```ts
 * import { GitPushParams } from "@noldova/git.protocol";
 * export const params: GitPushParams = new GitPushParams("/home/a/repo", "4f2a");
 * ```
 */
export declare class GitPushParams {
  /**
   * The repository's folder, an absolute POSIX, drive or UNC path of at most 4096 characters; untrusted.
   */
  public readonly folder: string;

  /**
   * The fingerprint of the status the caller showed; the call fails as `Stale` when it has moved.
   */
  public readonly basedOn: string;

  /**
   * Creates the parameters.
   * @param folder The folder; absolute, at most 4096 characters.
   * @param basedOn The status's fingerprint; not empty.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the folder isn't absolute or is too long, or the fingerprint is empty.
   * @example
   * ```ts
   * import { GitPushParams } from "@noldova/git.protocol";
   * export const params: GitPushParams = new GitPushParams("C:\\work\\repo", "4f2a");
   * ```
   */
  public constructor(folder: string, basedOn: string, reader?: JsonReader);

  /**
   * Reads the parameters from their JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The parameters' path in error messages; `$` by default.
   * @returns The parameters.
   * @throws {JsonException} When the value isn't an object, or a field is missing or not a text; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   * @example
   * ```ts
   * import { GitPushParams } from "@noldova/git.protocol";
   * export const params: GitPushParams = GitPushParams.fromJson({ folder: "/home/a/repo", basedOn: "4f2a" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): GitPushParams;

  /**
   * Writes the parameters' JSON form, with the fields `folder` and `basedOn`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { GitPushParams, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new GitPushParams("/home/a/repo", "4f2a").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of `git.log`: the folder and how many commits to read.
 * @example
 * ```ts
 * import { GitLogParams } from "@noldova/git.protocol";
 * export const params: GitLogParams = new GitLogParams("/home/a/repo", 50);
 * ```
 */
export declare class GitLogParams {
  /**
   * The repository's folder, an absolute POSIX, drive or UNC path of at most 4096 characters; untrusted.
   */
  public readonly folder: string;

  /**
   * The most commits to read, from 1 to 500.
   */
  public readonly limit: number;

  /**
   * Creates the parameters.
   * @param folder The folder; absolute, at most 4096 characters.
   * @param limit The most commits; a whole number from 1 to 500.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the folder isn't absolute or is too long, or the limit isn't a whole number from 1 to 500.
   * @example
   * ```ts
   * import { GitLogParams } from "@noldova/git.protocol";
   * export const params: GitLogParams = new GitLogParams("C:\\work\\repo", 500);
   * ```
   */
  public constructor(folder: string, limit: number, reader?: JsonReader);

  /**
   * Reads the parameters from their JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The parameters' path in error messages; `$` by default.
   * @returns The parameters.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   * @example
   * ```ts
   * import { GitLogParams } from "@noldova/git.protocol";
   * export const params: GitLogParams = GitLogParams.fromJson({ folder: "/home/a/repo", limit: 20 });
   * ```
   */
  public static fromJson(value: unknown, path?: string): GitLogParams;

  /**
   * Writes the parameters' JSON form, with the fields `folder` and `limit`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { GitLogParams, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new GitLogParams("/home/a/repo", 20).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * One commit of `git.log`: its id, parents, author's name, when it was authored and its subject, never the author's email.
 * @example
 * ```ts
 * import { GitCommit } from "@noldova/git.protocol";
 * export const commit: GitCommit = new GitCommit("4f2a".padEnd(40, "0"), [], "Sample Author", "2026-11-06T09:30:00-08:00", "Read the log");
 * ```
 */
export declare class GitCommit {
  /**
   * The commit's full object id, 40 or 64 lowercase hexadecimal digits.
   */
  public readonly id: string;

  /**
   * The parents' full object ids in git's order: none for a root commit, two or more for a merge.
   */
  public readonly parents: readonly string[];

  /**
   * The author's name as the commit records it, at most 1000 characters without a control character; untrusted.
   */
  public readonly author: string;

  /**
   * When the commit was authored, in ISO 8601 with the author's offset, such as `2026-11-06T09:30:00-08:00`.
   */
  public readonly authoredAt: string;

  /**
   * The message's first paragraph on one line, at most 1000 characters without a control character, so a window shows it as plain text; untrusted.
   */
  public readonly subject: string;

  /**
   * Creates the commit.
   * @param id The full object id.
   * @param parents The parents' full object ids.
   * @param author The author's name; at most 1000 characters, without a control character.
   * @param authoredAt When it was authored; ISO 8601 with its offset or `Z`.
   * @param subject The subject; at most 1000 characters, without a control character.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When an id isn't a full object id, the author or subject is too long or holds a control character, or the time isn't an ISO 8601 date and time with its offset.
   * @example
   * ```ts
   * import { GitCommit } from "@noldova/git.protocol";
   * export const merge: GitCommit = new GitCommit("a".repeat(40), ["b".repeat(40), "c".repeat(40)], "Sample Author", "2026-11-06T17:30:00Z", "Merge branch 'view'");
   * ```
   */
  public constructor(id: string, parents: readonly string[], author: string, authoredAt: string, subject: string, reader?: JsonReader);

  /**
   * Reads the commit from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The commit's path in error messages; `$` by default.
   * @returns The commit.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   * @example
   * ```ts
   * import { GitCommit } from "@noldova/git.protocol";
   * export const commit: GitCommit = GitCommit.fromJson({ id: "a".repeat(40), parents: [], author: "Sample Author", authoredAt: "2026-11-06T17:30:00Z", subject: "First" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): GitCommit;

  /**
   * Writes the commit's JSON form, with the fields `id`, `parents`, `author`, `authoredAt` and `subject`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { GitCommit, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new GitCommit("a".repeat(40), [], "Sample Author", "2026-11-06T17:30:00Z", "First").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The answer of `git.log`: HEAD's commits, newest first as git lists them, and whether more were left out past the limit.
 * @example
 * ```ts
 * import { GitLog } from "@noldova/git.protocol";
 * export const empty: GitLog = new GitLog([], false);
 * ```
 */
export declare class GitLog {
  /**
   * The commits, at most 500; none before the first commit.
   */
  public readonly commits: readonly GitCommit[];

  /**
   * Whether HEAD has more commits than the request's limit let in.
   */
  public readonly truncated: boolean;

  /**
   * Creates the log.
   * @param commits The commits; at most 500.
   * @param truncated Whether more were left out.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When it holds more than 500 commits.
   * @example
   * ```ts
   * import { GitCommit, GitLog } from "@noldova/git.protocol";
   * export const log: GitLog = new GitLog([new GitCommit("a".repeat(40), [], "Sample Author", "2026-11-06T17:30:00Z", "First")], false);
   * ```
   */
  public constructor(commits: readonly GitCommit[], truncated: boolean, reader?: JsonReader);

  /**
   * Reads the log from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The log's path in error messages; `$` by default.
   * @returns The log.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, too many commits, or a commit the protocol refuses.
   * @example
   * ```ts
   * import { GitLog } from "@noldova/git.protocol";
   * export const log: GitLog = GitLog.fromJson({ commits: [], truncated: false });
   * ```
   */
  public static fromJson(value: unknown, path?: string): GitLog;

  /**
   * Writes the log's JSON form, with the fields `commits` and `truncated`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { GitLog, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new GitLog([], false).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * One worktree of a repository, as `git worktree list` names it: its folder, the commit and branch it has checked out, and whether it's locked or prunable.
 * @example
 * ```ts
 * import { GitWorktree } from "@noldova/git.protocol";
 * export const worktree: GitWorktree = new GitWorktree("/home/a/repo", "a".repeat(40), "main", false, false);
 * ```
 */
export declare class GitWorktree {
  /**
   * The worktree's folder, an absolute POSIX, drive or UNC path of at most 4096 characters, as git prints it; untrusted.
   */
  public readonly path: string;

  /**
   * The commit it has checked out as a full object id; `null` before the first commit and for a bare repository.
   */
  public readonly head: string | null;

  /**
   * The branch it has checked out, without `refs/heads/`; `null` on a detached HEAD and for a bare repository; untrusted.
   */
  public readonly branch: string | null;

  /**
   * Whether the worktree is locked, so git keeps it from being pruned, moved or removed.
   */
  public readonly locked: boolean;

  /**
   * Whether git would prune it, such as when its folder is gone.
   */
  public readonly prunable: boolean;

  /**
   * Creates the worktree.
   * @param path The folder; absolute, at most 4096 characters.
   * @param head The commit's full object id, or `null`.
   * @param branch The branch; a name `git check-ref-format --branch` accepts, not starting with `-`; or `null`.
   * @param locked Whether it's locked.
   * @param prunable Whether git would prune it.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the folder isn't absolute or is too long, the head isn't a full object id, or the branch is a name git refuses.
   * @example
   * ```ts
   * import { GitWorktree } from "@noldova/git.protocol";
   * export const detached: GitWorktree = new GitWorktree("C:/work/repo-review", "b".repeat(40), null, true, false);
   * ```
   */
  public constructor(path: string, head: string | null, branch: string | null, locked: boolean, prunable: boolean, reader?: JsonReader);

  /**
   * Reads the worktree from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The worktree's path in error messages; `$` by default.
   * @returns The worktree.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   * @example
   * ```ts
   * import { GitWorktree } from "@noldova/git.protocol";
   * export const worktree: GitWorktree = GitWorktree.fromJson({ path: "/home/a/repo", head: null, branch: "main", locked: false, prunable: false });
   * ```
   */
  public static fromJson(value: unknown, path?: string): GitWorktree;

  /**
   * Writes the worktree's JSON form, with the fields `path`, `head`, `branch`, `locked` and `prunable`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { GitWorktree, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new GitWorktree("/home/a/repo", null, "main", false, false).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The answer of `git.worktrees`: the repository's worktrees, the main one first, as git lists them.
 * @example
 * ```ts
 * import { GitWorktree, GitWorktrees } from "@noldova/git.protocol";
 * export const worktrees: GitWorktrees = new GitWorktrees([new GitWorktree("/home/a/repo", null, "main", false, false)]);
 * ```
 */
export declare class GitWorktrees {
  /**
   * The worktrees, the main one first.
   */
  public readonly worktrees: readonly GitWorktree[];

  /**
   * Creates the list.
   * @param worktrees The worktrees.
   * @example
   * ```ts
   * import { GitWorktrees } from "@noldova/git.protocol";
   * export const none: GitWorktrees = new GitWorktrees([]);
   * ```
   */
  public constructor(worktrees: readonly GitWorktree[]);

  /**
   * Reads the list from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The list's path in error messages; `$` by default.
   * @returns The list.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a worktree the protocol refuses.
   * @example
   * ```ts
   * import { GitWorktrees } from "@noldova/git.protocol";
   * export const worktrees: GitWorktrees = GitWorktrees.fromJson({ worktrees: [] });
   * ```
   */
  public static fromJson(value: unknown, path?: string): GitWorktrees;

  /**
   * Writes the list's JSON form, with the field `worktrees`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { GitWorktrees, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new GitWorktrees([]).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The payload of the `git.changed` event: the watched folder whose repository changed, so a window reads its status again.
 * @example
 * ```ts
 * import type { GitChanged } from "@noldova/git.protocol";
 * export function concerns(changed: GitChanged, folder: string): boolean {
 *   return changed.folder === folder;
 * }
 * ```
 */
export declare class GitChanged {
  /**
   * The watched folder, as `git.watch` named it: an absolute POSIX, drive or UNC path of at most 4096 characters.
   */
  public readonly folder: string;

  /**
   * Creates the payload.
   * @param folder The folder; absolute, at most 4096 characters.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the folder isn't absolute or is longer than 4096 characters.
   * @example
   * ```ts
   * import { GitChanged } from "@noldova/git.protocol";
   * export const changed: GitChanged = new GitChanged("/home/a/repo");
   * ```
   */
  public constructor(folder: string, reader?: JsonReader);

  /**
   * Reads the payload from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The payload's path in error messages; `$` by default.
   * @returns The payload.
   * @throws {JsonException} When the value isn't an object, or the folder is missing or not a text; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or the folder is invalid.
   * @example
   * ```ts
   * import { GitChanged } from "@noldova/git.protocol";
   * export const changed: GitChanged = GitChanged.fromJson({ folder: "C:\\work\\repo" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): GitChanged;

  /**
   * Writes the payload's JSON form, with the field `folder`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { GitChanged, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new GitChanged("/home/a/repo").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The names the Git module's parts share: its id, its methods and its event.
 *
 * @example
 * ```ts
 * import { GitNames } from "@noldova/git.protocol";
 *
 * console.log(GitNames.moduleId, GitNames.statusMethod);
 * ```
 */
export declare class GitNames {
  /**
   * The module's id, as its module.json declares it.
   */
  public static readonly moduleId: string;

  /**
   * `git.status`: reads a folder's {@link GitStatus}, with {@link GitFolderParams}.
   */
  public static readonly statusMethod: string;

  /**
   * `git.diff`: reads a {@link GitDiff}, with {@link GitDiffParams}.
   */
  public static readonly diffMethod: string;

  /**
   * `git.branches`: reads a folder's {@link GitBranches}, with {@link GitFolderParams}.
   */
  public static readonly branchesMethod: string;

  /**
   * `git.log`: reads a folder's recent commits as a {@link GitLog}, with {@link GitLogParams}.
   */
  public static readonly logMethod: string;

  /**
   * `git.worktrees`: reads the worktrees of a folder's repository as {@link GitWorktrees}, with {@link GitFolderParams}.
   */
  public static readonly worktreesMethod: string;

  /**
   * `git.stage`: adds paths to the index, with {@link GitPathsParams}.
   */
  public static readonly stageMethod: string;

  /**
   * `git.unstage`: takes paths out of the index, with {@link GitPathsParams}.
   */
  public static readonly unstageMethod: string;

  /**
   * `git.createBranch`: creates a branch, with {@link GitBranchParams}.
   */
  public static readonly createBranchMethod: string;

  /**
   * `git.switchBranch`: checks out a branch, with {@link GitBranchParams}.
   */
  public static readonly switchBranchMethod: string;

  /**
   * `git.commit`: commits the index, with {@link GitCommitParams}.
   */
  public static readonly commitMethod: string;

  /**
   * `git.push`: pushes the checked-out branch, with {@link GitPushParams}.
   */
  public static readonly pushMethod: string;

  /**
   * `git.pull`: fast-forwards the checked-out branch to its upstream, with {@link GitPullParams};
   * it refuses as `NoUpstream`, `Conflict` or `Diverged` before git changes anything, and as `ChangesInTheWay` when git refuses to overwrite uncommitted changes.
   */
  public static readonly pullMethod: string;

  /**
   * `git.pullHooks`: reads the repository's hooks that a `git.pull` runs as {@link GitHooks}, with {@link GitFolderParams}.
   */
  public static readonly pullHooksMethod: string;

  /**
   * `git.watch`: starts sending `git.changed` for a folder, with {@link GitFolderParams}.
   */
  public static readonly watchMethod: string;

  /**
   * `git.unwatch`: stops sending `git.changed` for a folder, with {@link GitFolderParams}.
   */
  public static readonly unwatchMethod: string;

  /**
   * `git.changed`: the event a watched folder's change sends, with {@link GitChanged}.
   */
  public static readonly changedEvent: string;

  /**
   * `git.folder`: the binding by which an app gives an agent session its working folder, read with {@link GitFolderBinding}; the
   * module's agent tools act only in the repository that holds it.
   */
  public static readonly folderBinding: string;

  /**
   * `git.repositories`: the {@link GitRepositories} service the runtime part publishes for the modules that depend on `git`.
   */
  public static readonly repositoriesService: string;

  /**
   * `git_status`: the agent tool that reads the bound repository's status.
   */
  public static readonly statusTool: string;

  /**
   * `git_diff`: the agent tool that reads its unstaged or staged changes.
   */
  public static readonly diffTool: string;

  /**
   * `git_log`: the agent tool that reads the current branch's latest commits.
   */
  public static readonly logTool: string;

  /**
   * `git_branches`: the agent tool that reads its branches and remotes.
   */
  public static readonly branchesTool: string;

  /**
   * `git_stage`: the agent tool that stages paths.
   */
  public static readonly stageTool: string;

  /**
   * `git_unstage`: the agent tool that unstages paths.
   */
  public static readonly unstageTool: string;

  /**
   * `git_create_branch`: the agent tool that creates a branch and switches to it.
   */
  public static readonly createBranchTool: string;

  /**
   * `git_switch_branch`: the agent tool that switches to a branch.
   */
  public static readonly switchBranchTool: string;

  /**
   * `git_commit`: the agent tool that commits what is staged.
   */
  public static readonly commitTool: string;

  /**
   * `git_push`: the agent tool that pushes the current branch.
   */
  public static readonly pushTool: string;

  /**
   * `git_pull`: the agent tool that fast-forwards the current branch to its upstream.
   */
  public static readonly pullTool: string;
}
