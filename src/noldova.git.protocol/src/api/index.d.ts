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
  /**
   * The remote has commits the branch doesn't, so a push would replace them: refused before git runs when the last fetch shows the upstream ahead,
   * or by the remote as not a fast-forward.
   */
  readonly PushBehind: "PushBehind";
  /**
   * The folder has no changes a stash would take: none at all, or only untracked files while the stash leaves them out.
   */
  readonly NothingToStash: "NothingToStash";
};

/**
 * One of {@link GitCode}'s wire values.
 */
export type GitCode = (typeof GitCode)[keyof typeof GitCode];

/**
 * Which references `git.messageReferences` finds in commit messages.
 * @example
 * ```ts
 * import { GitMessageReferenceKind } from "@noldova/git.protocol";
 * export const kind: GitMessageReferenceKind = GitMessageReferenceKind.AzureBoards;
 * ```
 */
export declare const GitMessageReferenceKind: {
  /**
   * Azure Boards' `AB#N`, where N is a whole number from 1 to 9999999999 with no leading zero, standing on its own rather than inside a longer word,
   * path or link.
   */
  readonly AzureBoards: "AzureBoards";
};

/**
 * One of {@link GitMessageReferenceKind}'s wire values.
 */
export type GitMessageReferenceKind = (typeof GitMessageReferenceKind)[keyof typeof GitMessageReferenceKind];

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
   * The full id of the commit the upstream's tracking ref points at, as of the last fetch: what a force push with a lease would replace;
   * null when the upstream is gone or its ref can't be read.
   */
  public readonly id: string | null;

  /**
   * Creates the upstream.
   * @param name The upstream's name; not empty.
   * @param ahead The commits ahead; zero or more.
   * @param behind The commits behind; zero or more.
   * @param gone Whether the upstream is gone.
   * @param id The tracking ref's commit, a full id; null, the default, when it isn't known, and always when the upstream is gone.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the name is empty, a count isn't a whole number of zero or more, the id isn't a full id,
   * or a gone upstream has a count above 0 or an id.
   * @example
   * ```ts
   * import { StatusUpstream } from "@noldova/git.protocol";
   * export const upstream: StatusUpstream = new StatusUpstream("origin/main", 2, 0, false, "0123456789abcdef0123456789abcdef01234567");
   * ```
   */
  public constructor(name: string, ahead: number, behind: number, gone: boolean, id?: string | null, reader?: JsonReader);

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
   * export const upstream: StatusUpstream = StatusUpstream.fromJson({ name: "origin/main", ahead: 0, behind: 1, gone: false, id: null });
   * ```
   */
  public static fromJson(value: unknown, path?: string): StatusUpstream;

  /**
   * Writes the upstream's JSON form, with the fields `name`, `ahead`, `behind`, `gone` and `id`.
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
   * How far each local branch with an upstream is from it, in git's order, for only the branches that are ahead of it or behind it; untrusted.
   */
  public readonly tracks: readonly GitBranchTrack[];

  /**
   * The commit each local branch points at, in git's order; untrusted.
   */
  public readonly tips: readonly GitBranchTip[];

  /**
   * Creates the branches.
   * @param current The checked-out branch, or `null`; not empty.
   * @param branches The local branches; none empty.
   * @param remotes The remotes' names; none empty.
   * @param remoteBranches The remotes' branches; each a name `git check-ref-format --branch` accepts, not starting with `-`.
   * @param tracks How far branches are from their upstreams; each one of `branches`; none by default.
   * @param tips The commit each local branch points at; each one of `branches`, each branch once; none by default.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the current branch, a branch or a remote is empty, a remote branch is a name git refuses, a track names no local branch, or a tip names no local branch or one twice.
   * @example
   * ```ts
   * import { GitBranches } from "@noldova/git.protocol";
   * export const branches: GitBranches = new GitBranches("main", ["feature/view", "main"], ["origin"], ["origin/main"]);
   * ```
   */
  public constructor(current: string | null, branches: readonly string[], remotes: readonly string[], remoteBranches: readonly string[], tracks?: readonly GitBranchTrack[],
    tips?: readonly GitBranchTip[], reader?: JsonReader);

  /**
   * Reads the branches from their JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The branches' path in error messages; `$` by default.
   * @returns The branches.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, `branches` or `remotes` isn't an array of texts, a branch or a remote is empty, or a track or a tip is invalid.
   * @example
   * ```ts
   * import { GitBranches } from "@noldova/git.protocol";
   * export const branches: GitBranches = GitBranches.fromJson({ current: null, branches: ["main"], remotes: ["origin"], remoteBranches: ["origin/main"], tracks: [], tips: [] });
   * ```
   */
  public static fromJson(value: unknown, path?: string): GitBranches;

  /**
   * Writes the branches' JSON form, with the fields `current`, `branches`, `remotes`, `remoteBranches`, `tracks` and `tips`.
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
 * The commit a local branch points at, and when it was committed, so a view can start another branch from it without switching to it, or tell an old
 * branch from a new one.
 * @example
 * ```ts
 * import type { GitBranchTip } from "@noldova/git.protocol";
 * export function short(tip: GitBranchTip): string {
 *   return `${tip.branch} at ${tip.id.slice(0, 7)}`;
 * }
 * ```
 */
export declare class GitBranchTip {
  /**
   * The local branch without `refs/heads/`; untrusted.
   */
  public readonly branch: string;

  /**
   * The full id of the commit the branch points at.
   */
  public readonly id: string;

  /**
   * When the commit was committed, as git writes it in ISO 8601 with its offset, such as `2026-11-23T10:00:00+01:00`.
   */
  public readonly committedAt: string;

  /**
   * Creates the tip.
   * @param branch The local branch; not empty.
   * @param id The commit's full id, 40 or 64 hexadecimal digits.
   * @param committedAt When the commit was committed, an ISO 8601 date and time with its offset.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the branch is empty, the id isn't a full commit id or the time isn't a date and time with its offset.
   * @example
   * ```ts
   * import { GitBranchTip } from "@noldova/git.protocol";
   * export const tip: GitBranchTip = new GitBranchTip("main", "0123456789abcdef0123456789abcdef01234567", "2026-11-23T10:00:00+01:00");
   * ```
   */
  public constructor(branch: string, id: string, committedAt: string, reader?: JsonReader);

  /**
   * Reads the tip from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The tip's path in error messages; `$` by default.
   * @returns The tip.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, the branch is empty, the id isn't a full commit id or the time isn't a date and time with its offset.
   * @example
   * ```ts
   * import { GitBranchTip } from "@noldova/git.protocol";
   * export const tip: GitBranchTip = GitBranchTip.fromJson({ branch: "main", id: "0123456789abcdef0123456789abcdef01234567",
   *   committedAt: "2026-11-23T10:00:00+01:00" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): GitBranchTip;

  /**
   * Writes the tip's JSON form, with the fields `branch`, `id` and `committedAt`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { GitBranchTip, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new GitBranchTip("main", "0123456789abcdef0123456789abcdef01234567", "2026-11-23T10:00:00+01:00").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * How far a local branch is from its upstream: the commits it has that the upstream lacks, and the commits the upstream has that it lacks, as git last
 * fetched them; or, in {@link GitRemoteTracks}, how far a remote branch is from HEAD.
 * @example
 * ```ts
 * import type { GitBranchTrack } from "@noldova/git.protocol";
 * export function describe(track: GitBranchTrack): string {
 *   return `${track.branch}: ${track.ahead} ahead, ${track.behind} behind`;
 * }
 * ```
 */
export declare class GitBranchTrack {
  /**
   * The local branch without `refs/heads/`, or in {@link GitRemoteTracks} the remote branch as `<remote>/<branch>`; untrusted.
   */
  public readonly branch: string;

  /**
   * The commits the branch has that its upstream, or HEAD for a remote branch, lacks.
   */
  public readonly ahead: number;

  /**
   * The commits its upstream, or HEAD for a remote branch, has that the branch lacks.
   */
  public readonly behind: number;

  /**
   * Creates the track.
   * @param branch The local branch; not empty.
   * @param ahead The commits ahead; a whole number, 0 or more.
   * @param behind The commits behind; a whole number, 0 or more.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the branch is empty or a count isn't a whole number, 0 or more.
   * @example
   * ```ts
   * import { GitBranchTrack } from "@noldova/git.protocol";
   * export const track: GitBranchTrack = new GitBranchTrack("main", 2, 0);
   * ```
   */
  public constructor(branch: string, ahead: number, behind: number, reader?: JsonReader);

  /**
   * Reads the track from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The track's path in error messages; `$` by default.
   * @returns The track.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, the branch is empty or a count is negative.
   * @example
   * ```ts
   * import { GitBranchTrack } from "@noldova/git.protocol";
   * export const track: GitBranchTrack = GitBranchTrack.fromJson({ branch: "main", ahead: 0, behind: 3 });
   * ```
   */
  public static fromJson(value: unknown, path?: string): GitBranchTrack;

  /**
   * Writes the track's JSON form, with the fields `branch`, `ahead` and `behind`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { GitBranchTrack, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new GitBranchTrack("main", 1, 1).toJson();
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
 * How a look for repositories under a folder ended.
 * @example
 * ```ts
 * import { ScanEnd } from "@noldova/git.protocol";
 * export function isWhole(end: ScanEnd): boolean {
 *   return end === ScanEnd.Complete;
 * }
 * ```
 */
export declare const ScanEnd: {
  /**
   * The folder is in a repository itself, so no subfolder was looked at.
   */
  readonly Repository: "Repository";

  /**
   * Every subfolder within the depth was looked at.
   */
  readonly Complete: "Complete";

  /**
   * The look stopped at 1000 repositories, the first by name; a folder further down finds the rest.
   */
  readonly RepositoryLimit: "RepositoryLimit";

  /**
   * The look stopped after reading 10,000 folders; a folder further down finds the rest.
   */
  readonly FolderLimit: "FolderLimit";

  /**
   * The folder itself can't be read, or is gone.
   */
  readonly Unreadable: "Unreadable";
};

/**
 * One of {@link ScanEnd}'s wire values.
 */
export type ScanEnd = (typeof ScanEnd)[keyof typeof ScanEnd];

/**
 * What a folder the person chose holds: whether it's in a repository or can't be read, and otherwise the repositories found in its subfolders and whether the look stopped early.
 * @example
 * ```ts
 * import { ScanEnd, type GitRepositoryScan } from "@noldova/git.protocol";
 * export function isCut(scan: GitRepositoryScan): boolean {
 *   return scan.end === ScanEnd.RepositoryLimit || scan.end === ScanEnd.FolderLimit;
 * }
 * ```
 */
export declare class GitRepositoryScan {
  /**
   * How the look ended.
   */
  public readonly end: ScanEnd;

  /**
   * The absolute folders of the repositories found in the subfolders, sorted; empty when the folder is in a repository, can't be read, or none was found.
   */
  public readonly repositories: readonly string[];

  /**
   * Creates the scan's result.
   * @param end How the look ended.
   * @param repositories The repositories' absolute folders; at most 1000, and none when the folder is in a repository or can't be read.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When there are more than 1000 repositories, any for {@link ScanEnd.Repository} or {@link ScanEnd.Unreadable}, or one isn't an absolute path of at most 4096 characters.
   * @example
   * ```ts
   * import { GitRepositoryScan, ScanEnd } from "@noldova/git.protocol";
   * export const scan: GitRepositoryScan = new GitRepositoryScan(ScanEnd.Complete, ["/work/site"]);
   * ```
   */
  public constructor(end: ScanEnd, repositories: readonly string[], reader?: JsonReader);

  /**
   * Reads the scan's result from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The result's path in error messages; `$` by default.
   * @returns The scan's result.
   * @throws {JsonException} When the value isn't an object, `end` isn't one of {@link ScanEnd}'s values, or `repositories` isn't an array of texts; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or `repositories` breaks the constructor's rules.
   * @example
   * ```ts
   * import { GitRepositoryScan } from "@noldova/git.protocol";
   * export const scan: GitRepositoryScan = GitRepositoryScan.fromJson({ end: "Repository", repositories: [] });
   * ```
   */
  public static fromJson(value: unknown, path?: string): GitRepositoryScan;

  /**
   * Writes the scan's JSON form, with the fields `end` and `repositories`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { GitRepositoryScan, ScanEnd, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new GitRepositoryScan(ScanEnd.Repository, []).toJson();
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

  /**
   * Reads the user name in the address of one remote of the repository that holds a folder, such as `kim` in `https://kim@github.com/octocat/hello-world.git`,
   * after git's `insteadOf` rules, so a hosting module can pick the account the person's Git already uses there.
   * It is a person's name on a host: keep it in the main process, never in a window, a model's context, an answer or a log.
   * @param folder The folder; absolute, at most 4096 characters, untrusted.
   * @param name The remote's name, matched exactly.
   * @param signal Stops the read, which then rejects with the signal's reason.
   * @returns The decoded user name of an `http` or `https` address, or `null` for any other address, an address with no user name or one that isn't a
   * single line of at most 256 characters without a colon or slash, a repository with no remote of that name, or git's configuration that can't be read
   * in full; a password in the address is never read.
   * @throws {MethodFailureException} As {@link readStatusAsync} does.
   * @example
   * ```ts
   * import type { GitRepositories } from "@noldova/git.protocol";
   *
   * export function originUserAsync(repositories: GitRepositories, folder: string): Promise<string | null> {
   *   return repositories.readRemoteUserAsync(folder, "origin", new AbortController().signal);
   * }
   * ```
   */
  public abstract readRemoteUserAsync(folder: string, name: string, signal: AbortSignal): Promise<string | null>;
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
   * How many changed files that Git LFS tracks the runtime couldn't check against their pointers within its limits. Each still shows as Git
   * reported it, modified, though its content may match its pointer; 0 when every one was checked.
   */
  public readonly uncheckedLfsFiles: number;

  /** When the repository last fetched, from the modified time of its worktree's `FETCH_HEAD`, as an ISO 8601 date and time; `null` when it never has. */
  public readonly fetchedAt: string | null;

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
   * @param uncheckedLfsFiles The changed LFS files left unchecked; 0 by default.
   * @param fetchedAt When the repository last fetched, as an ISO 8601 date and time with its offset, or `null`, the default.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the branch or the fingerprint is empty, HEAD isn't a full object id, the unchecked count isn't a whole number
   * of zero or more, or the fetch time isn't an ISO 8601 date and time.
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
    uncheckedLfsFiles?: number,
    fetchedAt?: string | null,
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
   * Writes the status's JSON form, with the fields `branch`, `head`, `upstream`, `entries`, `truncated`, `fingerprint`, `operation`, `remote`, `uncheckedLfsFiles` and `fetchedAt`.
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
   * How alike a renamed or copied file is to the file it came from, as a whole percent from 0 to 100, as Git scores it (`R092` is 92);
   * `null` for any other change, and left out of the JSON form when `null`.
   */
  public readonly similarity: number | null;

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
   * @param similarity The rename's or copy's similarity in percent, or `null`, the default; always `null` unless the change is `Renamed` or `Copied`.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When a path is empty, bytes aren't base64, a mode isn't six octal digits or is present where the change rules it out, the old path differs from the path without a rename or copy, a binary file has hunks, or the similarity isn't a whole percent on a renamed or copied file.
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
    similarity?: number | null,
    reader?: JsonReader);

  /**
   * Reads the file's diff from its JSON form, where the bytes fields and the similarity may be missing.
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
   * Writes the file's JSON form; a bytes field or the similarity appears only when it isn't `undefined` or `null`.
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
 * A whole diff's counts, as `git diff --numstat` counts them, for a diff its budget cut: the files it changes and the lines they add and remove, a binary
 * file's lines counting none.
 * @example
 * ```ts
 * import type { DiffTotals } from "@noldova/git.protocol";
 * export function describe(totals: DiffTotals): string {
 *   return `${totals.files} files, +${totals.added} -${totals.removed}`;
 * }
 * ```
 */
export declare class DiffTotals {
  /**
   * The files the diff changes.
   */
  public readonly files: number;

  /**
   * The lines the files add.
   */
  public readonly added: number;

  /**
   * The lines the files remove.
   */
  public readonly removed: number;

  /**
   * Creates the totals.
   * @param files The files changed; zero or more.
   * @param added The lines added; zero or more.
   * @param removed The lines removed; zero or more.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When a count isn't a whole number of zero or more.
   * @example
   * ```ts
   * import { DiffTotals } from "@noldova/git.protocol";
   * export const totals: DiffTotals = new DiffTotals(3, 40, 7);
   * ```
   */
  public constructor(files: number, added: number, removed: number, reader?: JsonReader);

  /**
   * Reads the totals from their JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The totals' path in error messages; `$` by default.
   * @returns The totals.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a count is invalid.
   * @example
   * ```ts
   * import { DiffTotals } from "@noldova/git.protocol";
   * export function readTotals(text: string): DiffTotals {
   *   return DiffTotals.fromJson(JSON.parse(text));
   * }
   * ```
   */
  public static fromJson(value: unknown, path?: string): DiffTotals;

  /**
   * Writes the totals' JSON form, with the fields `files`, `added` and `removed`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { DiffTotals, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new DiffTotals(3, 40, 7).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A diff within its budget: the files, their size, how many were left out, and the whole diff's totals when it was cut.
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
   * The whole diff's files and lines when the budget cut it, so a count shows all of it; `null` when nothing was left out, or Git couldn't count it.
   */
  public readonly totals: DiffTotals | null;

  /**
   * Creates the diff.
   * @param files The files.
   * @param totalBytes The bytes shown; zero or more.
   * @param omittedFiles The files left out; zero or more.
   * @param truncated Whether anything was left out; `true` whenever files were.
   * @param totals The whole diff's totals, only when `truncated`; `null` by default.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When a count isn't a whole number of zero or more, files were left out without `truncated`, or totals come without it.
   * @example
   * ```ts
   * import { GitDiff } from "@noldova/git.protocol";
   * export const empty: GitDiff = new GitDiff([], 0, 0, false);
   * ```
   */
  public constructor(files: readonly DiffFile[], totalBytes: number, omittedFiles: number, truncated: boolean, totals?: DiffTotals | null, reader?: JsonReader);

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
   * Writes the diff's JSON form, with the fields `files`, `totalBytes`, `omittedFiles`, `truncated` and `totals`.
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
 *   return failure.gitCode === GitCode.PushBehind;
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
   * Answers whether the parameters take the name, by the rules {@link GitBranchParams.name} lists, so a caller can check a name before it asks.
   * @param name The branch's name, untrusted.
   * @returns Whether the name is one the parameters take.
   * @example
   * ```ts
   * import { GitBranchParams } from "@noldova/git.protocol";
   * export const isTaken: boolean = GitBranchParams.isBranchName("feature/view");
   * ```
   */
  public static isBranchName(name: string): boolean;

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
 * The parameters of `git.stageLines` and `git.unstageLines`: one file and the lines chosen in its diff.
 * A line is named by its place in the file's diff, counting every hunk's lines in order from 0, with the "No newline at end of file" lines;
 * a chosen context line changes nothing, and a hunk is all its added and removed lines.
 * @example
 * ```ts
 * import { GitLinesParams } from "@noldova/git.protocol";
 * export const params: GitLinesParams = new GitLinesParams("/home/a/repo", "src/a.ts", [3, 4], "fingerprint");
 * ```
 */
export declare class GitLinesParams {
  /**
   * The repository's folder, absolute.
   */
  public readonly folder: string;

  /**
   * The file, relative to the repository's top.
   */
  public readonly path: string;

  /**
   * The chosen lines, by their place in the file's diff.
   */
  public readonly lines: readonly number[];

  /**
   * The fingerprint of the status the person saw; a moved status refuses the write as stale.
   */
  public readonly basedOn: string;

  /**
   * Creates the parameters.
   * @param folder The folder; absolute.
   * @param path The file; a relative path.
   * @param lines The chosen lines; 1 to 100000 different whole numbers from 0.
   * @param basedOn The status fingerprint; not empty.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When a value breaks its rule above.
   */
  public constructor(folder: string, path: string, lines: readonly number[], basedOn: string, reader?: JsonReader);

  /**
   * Reads the parameters from their JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The parameters' path in error messages; `$` by default.
   * @returns The parameters.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   */
  public static fromJson(value: unknown, path?: string): GitLinesParams;

  /**
   * Writes the parameters' JSON form, with the fields `folder`, `path`, `lines` and `basedOn`.
   * @returns The JSON object.
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
 * What a label on a commit names.
 * @example
 * ```ts
 * import { RefKind } from "@noldova/git.protocol";
 * export function isLocal(kind: RefKind): boolean {
 *   return kind === RefKind.Branch;
 * }
 * ```
 */
export declare const RefKind: {
  /**
   * Where HEAD points: the current branch's name, or empty when HEAD is detached.
   */
  readonly Head: "Head";
  /**
   * A local branch.
   */
  readonly Branch: "Branch";
  /**
   * A remote's branch, named with its remote, such as `origin/main`.
   */
  readonly RemoteBranch: "RemoteBranch";
  /**
   * A tag.
   */
  readonly Tag: "Tag";
};

/**
 * One of {@link RefKind}'s wire values.
 */
export type RefKind = (typeof RefKind)[keyof typeof RefKind];

/**
 * How a write recorded in the journal is undone.
 * @example
 * ```ts
 * import { UndoMode } from "@noldova/git.protocol";
 * export function canUndo(mode: UndoMode): boolean {
 *   return mode !== UndoMode.None;
 * }
 * ```
 */
export declare const UndoMode: {
  /**
   * The write can't be undone, such as a push.
   */
  readonly None: "None";
  /**
   * The index is put back to its tree from before the write, with the working folder untouched.
   */
  readonly Index: "Index";
  /**
   * The refs are put back, keeping the index and the working folder, as for a commit or a soft reset.
   */
  readonly Refs: "Refs";
  /**
   * The current branch is reset back with its index, keeping the working folder, as for a mixed reset.
   */
  readonly Mixed: "Mixed";
  /**
   * The current branch is reset back keeping local changes, refused where one would be overwritten, as for a pull or a cherry-pick.
   */
  readonly Keep: "Keep";
  /**
   * HEAD is switched back to the branch or commit the write left, as for a branch switch.
   */
  readonly Switch: "Switch";
  /**
   * The paths a discard changed are put back from the checkpoint taken before it, leaving every other path, the index and the refs as they are.
   */
  readonly Checkpoint: "Checkpoint";
  /**
   * The stash the write made is popped back with its index, only while it is still the newest stash, HEAD is still the commit it was made on and
   * the folder has no changes, so it applies cleanly or not at all, keeping the stash.
   */
  readonly Stash: "Stash";
};

export type UndoMode = (typeof UndoMode)[keyof typeof UndoMode];

/**
 * What a reset keeps.
 * @example
 * ```ts
 * import { ResetMode } from "@noldova/git.protocol";
 * export const mode: ResetMode = ResetMode.Keep;
 * ```
 */
export declare const ResetMode: {
  /**
   * The index and the working folder, so the changes stay staged.
   */
  readonly Soft: "Soft";
  /**
   * The working folder only, so the changes stay unstaged.
   */
  readonly Mixed: "Mixed";
  /**
   * Local changes, refusing where one would be overwritten.
   */
  readonly Keep: "Keep";
};

export type ResetMode = (typeof ResetMode)[keyof typeof ResetMode];

/**
 * A label on a commit in `git.graph`'s answer.
 * @example
 * ```ts
 * import { GitRef, RefKind } from "@noldova/git.protocol";
 * export const main: GitRef = new GitRef(RefKind.Branch, "main");
 * ```
 */
export declare class GitRef {
  /**
   * What the label names.
   */
  public readonly kind: RefKind;

  /**
   * The short name, such as `main`, `origin/main` or `v1.2.0`; one line, from the repository and untrusted; empty only for a detached HEAD.
   */
  public readonly name: string;

  /**
   * Creates the label.
   * @param kind What it names.
   * @param name The short name; empty only for a detached HEAD.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the name isn't one line, or is empty for a branch or tag.
   */
  public constructor(kind: RefKind, name: string, reader?: JsonReader);

  /**
   * Reads the label from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The label's path in error messages; `$` by default.
   * @returns The label.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   */
  public static fromJson(value: unknown, path?: string): GitRef;

  /**
   * Writes the label's JSON form, with the fields `kind` and `name`.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * A commit in `git.graph`'s answer: the commit, its author's email and the labels that point at it.
 * @example
 * ```ts
 * import { GitCommit, GitGraphCommit } from "@noldova/git.protocol";
 * export const commit: GitGraphCommit = new GitGraphCommit(new GitCommit("a".repeat(40), [], "Sample Author", "2026-11-06T17:30:00Z", "First"), "author@example.com", []);
 * ```
 */
export declare class GitGraphCommit {
  /**
   * The commit.
   */
  public readonly commit: GitCommit;

  /**
   * The author's email; one line, from the repository and untrusted.
   */
  public readonly email: string;

  /**
   * The labels that point at the commit, in git's order.
   */
  public readonly refs: readonly GitRef[];

  /**
   * Creates the graph commit.
   * @param commit The commit.
   * @param email The author's email; one line.
   * @param refs The labels.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the email isn't one line.
   */
  public constructor(commit: GitCommit, email: string, refs: readonly GitRef[], reader?: JsonReader);

  /**
   * Reads the graph commit from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The commit's path in error messages; `$` by default.
   * @returns The graph commit.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   */
  public static fromJson(value: unknown, path?: string): GitGraphCommit;

  /**
   * Writes the graph commit's JSON form, with the fields `commit`, `email` and `refs`.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * The answer of `git.graph`: the commits of every branch, remote branch and tag, with HEAD, newest first with no parent before its children, and whether older ones were left out.
 * @example
 * ```ts
 * import { GitGraph } from "@noldova/git.protocol";
 * export const empty: GitGraph = new GitGraph([], false);
 * ```
 */
export declare class GitGraph {
  /**
   * The commits, at most 5000; none before the first commit.
   */
  public readonly commits: readonly GitGraphCommit[];

  /**
   * Whether the repository has more commits past this page.
   */
  public readonly truncated: boolean;

  /**
   * Creates the graph.
   * @param commits The commits; at most 5000.
   * @param truncated Whether more were left out.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When it holds more than 5000 commits.
   */
  public constructor(commits: readonly GitGraphCommit[], truncated: boolean, reader?: JsonReader);

  /**
   * Reads the graph from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The graph's path in error messages; `$` by default.
   * @returns The graph.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, too many commits, or a commit the protocol refuses.
   */
  public static fromJson(value: unknown, path?: string): GitGraph;

  /**
   * Writes the graph's JSON form, with the fields `commits` and `truncated`.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of `git.graph`: the folder whose repository to read, how many commits, and how many of the newest to skip, so a long history comes in pages.
 * @example
 * ```ts
 * import { GitGraphParams } from "@noldova/git.protocol";
 * export const params: GitGraphParams = new GitGraphParams("/home/sample/repo", 2000, 0);
 * ```
 */
export declare class GitGraphParams {
  /**
   * The folder; absolute, at most 4096 characters, untrusted.
   */
  public readonly folder: string;

  /**
   * How many commits; 1 to 5000.
   */
  public readonly limit: number;

  /**
   * How many of the newest commits to skip; 0 or more.
   */
  public readonly skip: number;

  /**
   * Creates the parameters.
   * @param folder The folder; absolute, at most 4096 characters.
   * @param limit How many commits; 1 to 5000.
   * @param skip How many to skip; 0 or more.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the folder isn't absolute, the limit is outside 1 to 5000, or the skip is negative or not whole.
   */
  public constructor(folder: string, limit: number, skip: number, reader?: JsonReader);

  /**
   * Reads the parameters from their JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The parameters' path in error messages; `$` by default.
   * @returns The parameters.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   */
  public static fromJson(value: unknown, path?: string): GitGraphParams;

  /**
   * Writes the parameters' JSON form, with the fields `folder`, `limit` and `skip`.
   * @returns The JSON object.
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
 * The parameters of `git.avatar`: the email of a commit's author.
 * @example
 * ```ts
 * import { GitAvatarParams } from "@noldova/git.protocol";
 * export const params: GitAvatarParams = new GitAvatarParams("kim@example.com");
 * ```
 */
export declare class GitAvatarParams {
  /**
   * The author's email as the commit names it, a line of 1 to 1000 characters without a control character; untrusted.
   */
  public readonly email: string;

  /**
   * Creates the parameters.
   * @param email The email; not empty, at most 1000 characters, without a control character.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the email is empty, longer than 1000 characters or holds a control character.
   * @example
   * ```ts
   * import { GitAvatarParams } from "@noldova/git.protocol";
   * export const params: GitAvatarParams = new GitAvatarParams("kim@example.com");
   * ```
   */
  public constructor(email: string, reader?: JsonReader);

  /**
   * Reads the parameters from their JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The parameters' path in error messages; `$` by default.
   * @returns The parameters.
   * @throws {JsonException} When the value isn't an object, or the email is missing or not a text; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or the email is invalid.
   * @example
   * ```ts
   * import { GitAvatarParams } from "@noldova/git.protocol";
   * export const params: GitAvatarParams = GitAvatarParams.fromJson({ email: "kim@example.com" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): GitAvatarParams;

  /**
   * Writes the parameters' JSON form, with the field `email`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { GitAvatarParams, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new GitAvatarParams("kim@example.com").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The answer of `git.avatar`: the author's picture from Gravatar, or none.
 * @example
 * ```ts
 * import type { GitAvatar } from "@noldova/git.protocol";
 * export function shown(avatar: GitAvatar): boolean {
 *   return avatar.image !== null;
 * }
 * ```
 */
export declare class GitAvatar {
  /**
   * The picture as a base64 `data:` address of a PNG, JPEG, GIF or WebP image, at most 90000 characters, or null when there is none.
   */
  public readonly image: string | null;

  /**
   * Creates the answer.
   * @param image The picture as a base64 `data:` address, or null.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the image isn't a PNG, JPEG, GIF or WebP base64 `data:` address or is longer than 90000 characters.
   * @example
   * ```ts
   * import { GitAvatar } from "@noldova/git.protocol";
   * export const avatar: GitAvatar = new GitAvatar(null);
   * ```
   */
  public constructor(image: string | null, reader?: JsonReader);

  /**
   * Reads the answer from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The answer's path in error messages; `$` by default.
   * @returns The answer.
   * @throws {JsonException} When the value isn't an object, or the image is missing or neither a text nor null; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or the image is invalid.
   * @example
   * ```ts
   * import { GitAvatar } from "@noldova/git.protocol";
   * export const avatar: GitAvatar = GitAvatar.fromJson({ image: null });
   * ```
   */
  public static fromJson(value: unknown, path?: string): GitAvatar;

  /**
   * Writes the answer's JSON form, with the field `image`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { GitAvatar, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new GitAvatar(null).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of `git.createBranchAt`: the folder, the new branch's name, the commit it starts at and the status fingerprint the person saw.
 * @example
 * ```ts
 * import { GitBranchAtParams } from "@noldova/git.protocol";
 * export const params: GitBranchAtParams = new GitBranchAtParams("/home/a/repo", "fix", "0123456789abcdef0123456789abcdef01234567", "fingerprint");
 * ```
 */
export declare class GitBranchAtParams {
  /**
   * The repository's folder, absolute.
   */
  public readonly folder: string;

  /**
   * The new branch's name.
   */
  public readonly name: string;

  /**
   * The full id of the commit the branch starts at.
   */
  public readonly id: string;

  /**
   * The fingerprint of the status the person saw; a moved status refuses the write as stale.
   */
  public readonly basedOn: string;

  /**
   * Creates the parameters.
   * @param folder The folder; absolute.
   * @param name The branch's name; a valid branch name.
   * @param id The commit's full id.
   * @param basedOn The status fingerprint; not empty.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When a value breaks its rule above.
   */
  public constructor(folder: string, name: string, id: string, basedOn: string, reader?: JsonReader);

  /**
   * Reads the parameters from their JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The parameters' path in error messages; `$` by default.
   * @returns The parameters.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   */
  public static fromJson(value: unknown, path?: string): GitBranchAtParams;

  /**
   * Writes the parameters' JSON form, with the fields `folder`, `name`, `id` and `basedOn`.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of `git.renameBranch`: the folder, the branch, its new name and the status fingerprint the person saw.
 * @example
 * ```ts
 * import { GitBranchRenameParams } from "@noldova/git.protocol";
 * export const params: GitBranchRenameParams = new GitBranchRenameParams("/home/a/repo", "fix", "fix-typo", "fingerprint");
 * ```
 */
export declare class GitBranchRenameParams {
  /**
   * The repository's folder, absolute.
   */
  public readonly folder: string;

  /**
   * The branch's name now.
   */
  public readonly name: string;

  /**
   * The branch's new name.
   */
  public readonly newName: string;

  /**
   * The fingerprint of the status the person saw; a moved status refuses the write as stale.
   */
  public readonly basedOn: string;

  /**
   * Creates the parameters.
   * @param folder The folder; absolute.
   * @param name The branch's name; a valid branch name.
   * @param newName The new name; a valid branch name.
   * @param basedOn The status fingerprint; not empty.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When a value breaks its rule above.
   */
  public constructor(folder: string, name: string, newName: string, basedOn: string, reader?: JsonReader);

  /**
   * Reads the parameters from their JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The parameters' path in error messages; `$` by default.
   * @returns The parameters.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   */
  public static fromJson(value: unknown, path?: string): GitBranchRenameParams;

  /**
   * Writes the parameters' JSON form, with the fields `folder`, `name`, `newName` and `basedOn`.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of `git.createTag`: the folder, the new tag's name, the commit it points at and the status fingerprint the person saw.
 * @example
 * ```ts
 * import { GitTagAtParams } from "@noldova/git.protocol";
 * export const params: GitTagAtParams = new GitTagAtParams("/home/a/repo", "v1.2.0", "0123456789abcdef0123456789abcdef01234567", "fingerprint");
 * ```
 */
export declare class GitTagAtParams {
  /**
   * The repository's folder, absolute.
   */
  public readonly folder: string;

  /**
   * The new tag's name.
   */
  public readonly name: string;

  /**
   * The full id of the commit the tag points at.
   */
  public readonly id: string;

  /**
   * The fingerprint of the status the person saw; a moved status refuses the write as stale.
   */
  public readonly basedOn: string;

  /**
   * Creates the parameters.
   * @param folder The folder; absolute.
   * @param name The tag's name; a valid ref name, by the rules of a branch's.
   * @param id The commit's full id.
   * @param basedOn The status fingerprint; not empty.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When a value breaks its rule above.
   */
  public constructor(folder: string, name: string, id: string, basedOn: string, reader?: JsonReader);

  /**
   * Reads the parameters from their JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The parameters' path in error messages; `$` by default.
   * @returns The parameters.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   */
  public static fromJson(value: unknown, path?: string): GitTagAtParams;

  /**
   * Writes the parameters' JSON form, with the fields `folder`, `name`, `id` and `basedOn`.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of `git.deleteTag`: the folder, the tag and the status fingerprint the person saw.
 * @example
 * ```ts
 * import { GitTagParams } from "@noldova/git.protocol";
 * export const params: GitTagParams = new GitTagParams("/home/a/repo", "v1.2.0", "fingerprint");
 * ```
 */
export declare class GitTagParams {
  /**
   * The repository's folder, absolute.
   */
  public readonly folder: string;

  /**
   * The tag's name.
   */
  public readonly name: string;

  /**
   * The fingerprint of the status the person saw; a moved status refuses the write as stale.
   */
  public readonly basedOn: string;

  /**
   * Creates the parameters.
   * @param folder The folder; absolute.
   * @param name The tag's name; a valid ref name, by the rules of a branch's.
   * @param basedOn The status fingerprint; not empty.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When a value breaks its rule above.
   */
  public constructor(folder: string, name: string, basedOn: string, reader?: JsonReader);

  /**
   * Reads the parameters from their JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The parameters' path in error messages; `$` by default.
   * @returns The parameters.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   */
  public static fromJson(value: unknown, path?: string): GitTagParams;

  /**
   * Writes the parameters' JSON form, with the fields `folder`, `name` and `basedOn`.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of `git.cherryPick`, `git.revert` and `git.merge`: the folder, the commit's full id and the status fingerprint the person saw.
 * @example
 * ```ts
 * import { GitPickParams } from "@noldova/git.protocol";
 * export const params: GitPickParams = new GitPickParams("/home/a/repo", "0123456789abcdef0123456789abcdef01234567", "fingerprint");
 * ```
 */
export declare class GitPickParams {
  /**
   * The repository's folder, absolute.
   */
  public readonly folder: string;

  /**
   * The commit's full id.
   */
  public readonly id: string;

  /**
   * The fingerprint of the status the person saw; a moved status refuses the write as stale.
   */
  public readonly basedOn: string;

  /**
   * Creates the parameters.
   * @param folder The folder; absolute.
   * @param id The commit's full id.
   * @param basedOn The status fingerprint; not empty.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the folder isn't absolute, the id isn't a full object id, or the fingerprint is empty.
   */
  public constructor(folder: string, id: string, basedOn: string, reader?: JsonReader);

  /**
   * Reads the parameters from their JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The parameters' path in error messages; `$` by default.
   * @returns The parameters.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   */
  public static fromJson(value: unknown, path?: string): GitPickParams;

  /**
   * Writes the parameters' JSON form, with the fields `folder`, `id` and `basedOn`.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of `git.commitDetail` and `git.commitSignature`: the folder and the commit's full id.
 * @example
 * ```ts
 * import { GitCommitDetailParams } from "@noldova/git.protocol";
 * export const params: GitCommitDetailParams = new GitCommitDetailParams("/home/a/repo", "0123456789abcdef0123456789abcdef01234567");
 * ```
 */
export declare class GitCommitDetailParams {
  /**
   * The repository's folder, absolute.
   */
  public readonly folder: string;

  /**
   * The commit's full id.
   */
  public readonly id: string;

  /**
   * Creates the parameters.
   * @param folder The folder; absolute.
   * @param id The commit's full id.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the folder isn't absolute, or the id isn't a full object id.
   */
  public constructor(folder: string, id: string, reader?: JsonReader);

  /**
   * Reads the parameters from their JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The parameters' path in error messages; `$` by default.
   * @returns The parameters.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   */
  public static fromJson(value: unknown, path?: string): GitCommitDetailParams;

  /**
   * Writes the parameters' JSON form, with the fields `folder` and `id`.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * The answer of `git.commitDetail`: what a graph row leaves out of a commit, its message after the subject and who committed it and when.
 * @example
 * ```ts
 * import { GitCommitDetail } from "@noldova/git.protocol";
 * export const detail: GitCommitDetail = new GitCommitDetail("0123456789abcdef0123456789abcdef01234567", "Why it changed.", "A Person", "a@example.com",
 *   "2026-11-20T14:02:00Z", false);
 * ```
 */
export declare class GitCommitDetail {
  /**
   * The commit's full id.
   */
  public readonly id: string;

  /**
   * The message after its subject and the blank line, as git keeps it; untrusted, and empty when there is none.
   */
  public readonly body: string;

  /**
   * The committer's name; untrusted.
   */
  public readonly committer: string;

  /**
   * The committer's email; untrusted.
   */
  public readonly committerEmail: string;

  /**
   * When the commit was committed, in ISO 8601 with its offset.
   */
  public readonly committedAt: string;

  /**
   * Whether the body was cut at the read's limit.
   */
  public readonly truncated: boolean;

  /**
   * Creates the detail.
   * @param id The commit's full id.
   * @param body The body; without a NUL.
   * @param committer The name; one line.
   * @param committerEmail The email; one line.
   * @param committedAt The time; one line, not empty.
   * @param truncated Whether the body was cut.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When a value breaks its rule above.
   */
  public constructor(id: string, body: string, committer: string, committerEmail: string, committedAt: string, truncated: boolean, reader?: JsonReader);

  /**
   * Reads the detail from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The detail's path in error messages; `$` by default.
   * @returns The detail.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   */
  public static fromJson(value: unknown, path?: string): GitCommitDetail;

  /**
   * Writes the detail's JSON form, with the fields `id`, `body`, `committer`, `committerEmail`, `committedAt` and `truncated`.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * A tag: its short name and the commit it points at.
 * @example
 * ```ts
 * import { GitTag } from "@noldova/git.protocol";
 * export const tag: GitTag = new GitTag("v1.2.0", "0123456789abcdef0123456789abcdef01234567");
 * ```
 */
export declare class GitTag {
  /**
   * The tag's name without `refs/tags/`; untrusted.
   */
  public readonly name: string;

  /**
   * The full id of the commit the tag points at, through an annotated tag.
   */
  public readonly id: string;

  /**
   * Creates the tag.
   * @param name The name; one line, not empty.
   * @param id The commit's full id.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the name is empty or not one line, or the id isn't a full object id.
   */
  public constructor(name: string, id: string, reader?: JsonReader);

  /**
   * Reads the tag from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The tag's path in error messages; `$` by default.
   * @returns The tag.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   */
  public static fromJson(value: unknown, path?: string): GitTag;

  /**
   * Writes the tag's JSON form, with the fields `name` and `id`.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * A stash in the stash list.
 * @example
 * ```ts
 * import { GitStash } from "@noldova/git.protocol";
 * export const stash: GitStash = new GitStash(0, "WIP on main: 0123456 Start", "0123456789abcdef0123456789abcdef01234567");
 * ```
 */
export declare class GitStash {
  /**
   * The stash's place in the list, 0 for the newest, as in `stash@{0}`.
   */
  public readonly index: number;

  /**
   * The stash's message; untrusted.
   */
  public readonly message: string;

  /**
   * The full id of the stash's commit.
   */
  public readonly id: string;

  /**
   * Creates the stash.
   * @param index Its place; a whole number of zero or more.
   * @param message The message; one line.
   * @param id The commit's full id.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the index isn't a whole number of zero or more, the message isn't one line, or the id isn't a full object id.
   */
  public constructor(index: number, message: string, id: string, reader?: JsonReader);

  /**
   * Reads the stash from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The stash's path in error messages; `$` by default.
   * @returns The stash.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   */
  public static fromJson(value: unknown, path?: string): GitStash;

  /**
   * Writes the stash's JSON form, with the fields `index`, `message` and `id`.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * A submodule the index records.
 * @example
 * ```ts
 * import { GitSubmodule } from "@noldova/git.protocol";
 * export const submodule: GitSubmodule = new GitSubmodule("vendor/lib", "0123456789abcdef0123456789abcdef01234567");
 * ```
 */
export declare class GitSubmodule {
  /**
   * The submodule's path from the repository's top, with `/` between segments; untrusted.
   */
  public readonly path: string;

  /**
   * The full id of the commit the index records for the submodule.
   */
  public readonly id: string;

  /**
   * Creates the submodule.
   * @param path The path; relative, without an empty, `.` or `..` segment.
   * @param id The commit's full id.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the path isn't relative, or the id isn't a full object id.
   */
  public constructor(path: string, id: string, reader?: JsonReader);

  /**
   * Reads the submodule from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The submodule's path in error messages; `$` by default.
   * @returns The submodule.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   */
  public static fromJson(value: unknown, path?: string): GitSubmodule;

  /**
   * Writes the submodule's JSON form, with the fields `path` and `id`.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * The answer of `git.repositoryItems`, which takes a `GitFolderParams`: the repository's tags, newest first, its stashes, newest first, and its
 * submodules, by path, each list cut at its limit.
 * @example
 * ```ts
 * import { GitRepositoryItems } from "@noldova/git.protocol";
 * export const items: GitRepositoryItems = new GitRepositoryItems([], [], [], false);
 * ```
 */
export declare class GitRepositoryItems {
  /**
   * The tags, newest first.
   */
  public readonly tags: readonly GitTag[];

  /**
   * The stashes, newest first.
   */
  public readonly stashes: readonly GitStash[];

  /**
   * The submodules, by path.
   */
  public readonly submodules: readonly GitSubmodule[];

  /**
   * Whether any list was cut at its limit.
   */
  public readonly truncated: boolean;

  /**
   * Creates the items.
   * @param tags The tags.
   * @param stashes The stashes.
   * @param submodules The submodules.
   * @param truncated Whether any list was cut.
   */
  public constructor(tags: readonly GitTag[], stashes: readonly GitStash[], submodules: readonly GitSubmodule[], truncated: boolean);

  /**
   * Reads the items from their JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The items' path in error messages; `$` by default.
   * @returns The items.
   * @throws {JsonException} When the value isn't an object, or a field, or a field of a tag, stash or submodule, is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   */
  public static fromJson(value: unknown, path?: string): GitRepositoryItems;

  /**
   * Writes the items' JSON form, with the fields `tags`, `stashes`, `submodules` and `truncated`.
   * @returns The JSON object.
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
   * `git.diffTotals`: reads a diff's {@link DiffTotals} with {@link GitDiffParams}, as `git diff --numstat` counts them and without the diff itself, so a
   * view can show a large range's counts cheaply; the worktree's counts leave out its untracked files.
   */
  public static readonly diffTotalsMethod: string;

  /**
   * `git.branches`: reads a folder's {@link GitBranches}, with {@link GitFolderParams}.
   */
  public static readonly branchesMethod: string;

  /**
   * `git.log`: reads a folder's recent commits as a {@link GitLog}, with {@link GitLogParams}.
   */
  public static readonly logMethod: string;

  /**
   * `git.graph`: reads a page of the commits of every branch, remote branch and tag, with their labels, as {@link GitGraph}.
   */
  public static readonly graphMethod: string;

  /**
   * `git.messageReferences`: finds which of the newest commits, in the order of `git.graph`, name references of a kind in their whole messages,
   * as {@link GitMessageReferences}, with {@link GitMessageReferencesParams}.
   */
  public static readonly messageReferencesMethod: string;

  /**
   * `git.mergedBranches`: reads which local branches the branch a remote's HEAD names already holds, as {@link GitMergedBranches}, with
   * {@link GitFolderParams}; it reads more than `git.branches`, so a view asks for it only when it shows it.
   */
  public static readonly mergedBranchesMethod: string;

  /**
   * `git.remoteTracks`: reads how far each remote branch is ahead of and behind HEAD, as {@link GitRemoteTracks}, with {@link GitFolderParams}; it needs git
   * 2.41 or later and answers none on an older git or before HEAD's first commit, and it reads more than `git.branches`, so a view asks for it only when
   * it shows the remote branches.
   */
  public static readonly remoteTracksMethod: string;

  /**
   * `git.worktrees`: reads the worktrees of a folder's repository as {@link GitWorktrees}, with {@link GitFolderParams}.
   */
  public static readonly worktreesMethod: string;

  /**
   * `git.repositoryItems`: reads the tags, stashes and submodules of a folder's repository as {@link GitRepositoryItems}, with {@link GitFolderParams}.
   */
  public static readonly repositoryItemsMethod: string;

  /**
   * `git.commitDetail`: reads a commit's message after its subject and its committer as {@link GitCommitDetail}, with {@link GitCommitDetailParams}.
   */
  public static readonly commitDetailMethod: string;

  /**
   * `git.commitSignature`: checks a commit's signature as {@link GitCommitSignature}, with {@link GitCommitDetailParams}.
   * It runs only the signing programs and allowed signers file of the person's global or system git configuration, or git's defaults, never
   * ones the repository's own configuration names.
   */
  public static readonly commitSignatureMethod: string;

  /**
   * `git.commitSigning`: reads whether git signs a new commit in the folder's repository, and in which format, as {@link GitCommitSigning}, with
   * {@link GitFolderParams}. It reads `commit.gpgsign` and `gpg.format` from every scope git reads and runs no signing program.
   */
  public static readonly commitSigningMethod: string;

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
   * `git.amend`: replaces the last commit with one that holds its changes and the staged ones, under a new message, with {@link GitCommitParams}; for the app's
   * main process only, and refused while the last commit is already on the branch's upstream.
   */
  public static readonly amendMethod: string;

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
   * `git.cherryPick`: applies a commit's change onto the current branch as a new commit, with {@link GitPickParams}; for the app's main process only.
   */
  public static readonly cherryPickMethod: string;

  /**
   * `git.revert`: makes a commit that undoes a commit's change, with {@link GitPickParams}; for the app's main process only.
   */
  public static readonly revertMethod: string;

  /**
   * `git.createBranchAt`: makes a branch at a commit without switching to it, with {@link GitBranchAtParams}; for the app's main process only.
   */
  public static readonly createBranchAtMethod: string;

  /**
   * `git.renameBranch`: renames a branch, with {@link GitBranchRenameParams}; for the app's main process only.
   */
  public static readonly renameBranchMethod: string;

  /**
   * `git.deleteBranch`: deletes a branch whose commits are merged, with {@link GitBranchParams}; for the app's main process only.
   */
  public static readonly deleteBranchMethod: string;

  /**
   * `git.createTag`: makes a tag at a commit, with {@link GitTagAtParams}; for the app's main process only.
   */
  public static readonly createTagMethod: string;

  /**
   * `git.deleteTag`: deletes a tag, with {@link GitTagParams}; for the app's main process only.
   */
  public static readonly deleteTagMethod: string;

  /**
   * `git.stageLines`: stages chosen lines of one file's worktree changes, with {@link GitLinesParams}; for the app's main process only.
   */
  public static readonly stageLinesMethod: string;

  /**
   * `git.unstageLines`: unstages chosen lines of one file's staged changes, with {@link GitLinesParams}; for the app's main process only.
   */
  public static readonly unstageLinesMethod: string;

  /**
   * `git.discard`: puts paths' working-folder changes back to the index, and removes untracked paths, with
   * {@link GitPathsParams}.
   */
  public static readonly discardMethod: string;

  /**
   * `git.journal`: reads a repository's recent writes, as {@link GitJournal}, with {@link GitFolderParams}.
   */
  public static readonly journalMethod: string;

  /**
   * `git.commandLog`: reads the git commands a repository's writes ran, as {@link GitCommandLog}, with {@link GitFolderParams}.
   */
  public static readonly commandLogMethod: string;

  /**
   * `git.undo`: undoes a journal entry's write, with {@link GitUndoParams}; for the app's main process only.
   */
  public static readonly undoMethod: string;

  /**
   * `git.reset`: moves the current branch to a commit, with {@link GitResetParams}; for the app's main process only.
   */
  public static readonly resetMethod: string;

  /**
   * `git.undoCommit`: moves the current branch back past its last commit, keeping its changes staged, with {@link GitUndoCommitParams}; for the app's main process only.
   */
  public static readonly undoCommitMethod: string;

  /**
   * `git.forcePush`: replaces the upstream's commits with the current branch's, with a lease, with {@link GitForcePushParams}; for the app's main process only.
   */
  public static readonly forcePushMethod: string;

  /**
   * `git.pullHooks`: reads the repository's hooks that a `git.pull` runs as {@link GitHooks}, with {@link GitFolderParams}.
   */
  public static readonly pullHooksMethod: string;

  /**
   * `git.avatar`: reads an author's picture from Gravatar as {@link GitAvatar}, with {@link GitAvatarParams}.
   */
  public static readonly avatarMethod: string;

  /**
   * `git.scanRepositories`: looks for the repositories in a folder's subfolders as {@link GitRepositoryScan}, with {@link GitFolderParams}.
   */
  public static readonly scanRepositoriesMethod: string;

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
  /**
   * `git.conflict`: reads one unmerged path's stages and merged text, with {@link GitConflictParams}; answers {@link GitConflict}.
   */
  public static readonly conflictMethod: string;

  /**
   * `git.resolveConflict`: writes and stages one unmerged path's resolution, with {@link GitResolveParams}.
   */
  public static readonly resolveConflictMethod: string;

  /**
   * `git.markerCheck`: finds the tracked files, staged or not, that still have a conflict marker line, as `git diff --check` finds them, with
   * {@link GitFolderParams}; answers {@link GitMarkerCheck}. It changes nothing.
   */
  public static readonly markerCheckMethod: string;

  /**
   * `git.continueOperation`: continues the merge, rebase, cherry-pick or revert in progress once no path is unmerged, with {@link GitOperationParams}.
   */
  public static readonly continueOperationMethod: string;

  /**
   * `git.abortOperation`: aborts the merge, rebase, cherry-pick or revert in progress, with {@link GitOperationParams}.
   */
  public static readonly abortOperationMethod: string;

  /**
   * `git.skipOperation`: skips the commit the rebase, cherry-pick or revert in progress stopped at and goes on to the next, with {@link GitOperationParams}; refused for a merge, which git can't skip.
   */
  public static readonly skipOperationMethod: string;

  /**
   * `git.predict`: works out what merging a commit into the current branch, or cherry-picking or reverting it there, would do, with {@link GitPredictParams}, answering {@link GitPrediction}; it changes neither the working folder nor the index.
   */
  public static readonly predictMethod: string;

  /**
   * `git.merge`: merges a commit into the current branch, fast-forwarding when it can, with {@link GitPickParams}; for the app's main process only.
   */
  public static readonly mergeMethod: string;

  /**
   * `git.fetch`: fetches the current branch's remote, so the status shows its upstream as the remote has it, with {@link GitFetchParams}; for the app's main process only.
   */
  public static readonly fetchMethod: string;

  /**
   * `git.stash`: puts the folder's changes into a new stash, with {@link GitStashParams}, refused as `NothingToStash` when there are none; for the app's main
   * process only.
   */
  public static readonly stashMethod: string;

  /**
   * `git.rebasePlan`: reads what rebasing the current branch onto a commit would replay, with {@link GitRebasePlanParams}, answering {@link GitRebasePlan}; it changes nothing.
   */
  public static readonly rebasePlanMethod: string;

  /**
   * `git.rebaseCheck`: works out what each step of an interactive rebase would do, with {@link GitRebaseCheckParams}, answering {@link GitRebaseCheck};
   * it touches neither the branch, the index nor the working folder.
   */
  public static readonly rebaseCheckMethod: string;

  /**
   * `git.rebase`: rebases the current branch onto a commit with the given steps, with {@link GitRebaseParams}; it stops on a conflict or an Edit step,
   * which `git.continueOperation`, `git.skipOperation` and `git.abortOperation` then finish; for the app's main process only.
   */
  public static readonly rebaseMethod: string;
}

/**
 * A ref a write moved: HEAD itself when detached, or a full branch or tag name, with its commit before and after.
 * @example
 * ```ts
 * import { GitRefMove } from "@noldova/git.protocol";
 * export const move: GitRefMove = new GitRefMove("refs/heads/main", "a".repeat(40), "b".repeat(40));
 * ```
 */
export declare class GitRefMove {
  /**
   * `HEAD`, or the full name, such as `refs/heads/main` or `refs/tags/v1.0.0`.
   */
  public readonly name: string;

  /**
   * The commit before the write, or null when the write created the ref.
   */
  public readonly before: string | null;

  /**
   * The commit after the write, or null when the write deleted the ref.
   */
  public readonly after: string | null;

  /**
   * Creates the move.
   * @param name `HEAD`, or the full branch or tag name.
   * @param before The commit before, or null.
   * @param after The commit after, or null; it differs from `before`.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the name isn't HEAD, a branch or a tag, an id isn't a full one, or both sides are the same.
   */
  public constructor(name: string, before: string | null, after: string | null, reader?: JsonReader);

  /**
   * Reads the move from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The move's path in error messages; `$` by default.
   * @returns The move.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field or a value the protocol refuses.
   */
  public static fromJson(value: unknown, path?: string): GitRefMove;

  /**
   * Writes the move's JSON form, with the fields `name`, `before` and `after`.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * One write in a repository's journal, with what it moved and how it is undone.
 * @example
 * ```ts
 * import { GitJournalEntry, UndoMode } from "@noldova/git.protocol";
 * export const entry: GitJournalEntry = new GitJournalEntry("1", "git.push", "2026-11-22T20:15:00Z", "main", "main", [], UndoMode.None, null, null);
 * ```
 */
export declare class GitJournalEntry {
  /**
   * The entry's id, which `git.undo` names.
   */
  public readonly id: string;

  /**
   * The method that wrote, such as `git.commit`.
   */
  public readonly method: string;

  /**
   * When it wrote, as an ISO 8601 date and time with its offset.
   */
  public readonly at: string;

  /**
   * The branch checked out before the write, or null when HEAD was detached.
   */
  public readonly branch: string | null;

  /**
   * The branch checked out after the write, or null when HEAD was detached.
   */
  public readonly branchAfter: string | null;

  /**
   * The refs the write moved.
   */
  public readonly moves: readonly GitRefMove[];

  /**
   * How the write is undone; {@link UndoMode.None} when it can't be.
   */
  public readonly undo: UndoMode;

  /**
   * The index's tree before an index write, or null for any other write.
   */
  public readonly indexBefore: string | null;

  /**
   * The index's tree after an index write, or null for any other write.
   */
  public readonly indexAfter: string | null;

  /**
   * The checkpoint taken before a discard, which an undo puts its paths back from, or the stash commit a stash made, which an undo pops; null for
   * any other write.
   */
  public readonly checkpoint: string | null;

  /**
   * The paths a discard changed, which an undo puts back from its checkpoint; empty for any other write.
   */
  public readonly paths: readonly string[];

  /**
   * Creates the entry.
   * @param id The entry's id.
   * @param method The method that wrote.
   * @param at When it wrote.
   * @param branch The branch before, or null.
   * @param branchAfter The branch after, or null.
   * @param moves The refs it moved.
   * @param undo How it is undone.
   * @param indexBefore The index's tree before, exactly when `undo` is {@link UndoMode.Index}.
   * @param indexAfter The index's tree after, exactly when `undo` is {@link UndoMode.Index}.
   * @param checkpoint The checkpoint taken before a discard, exactly when `undo` is {@link UndoMode.Checkpoint}, or the stash commit's id, exactly when it
   * is {@link UndoMode.Stash}; null by default.
   * @param paths The relative paths an undo puts back from the checkpoint, not empty exactly when `undo` is {@link UndoMode.Checkpoint}; none by default.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When a field holds a value the protocol refuses, or the trees or the checkpoint don't match the mode.
   */
  public constructor(
    id: string,
    method: string,
    at: string,
    branch: string | null,
    branchAfter: string | null,
    moves: readonly GitRefMove[],
    undo: UndoMode,
    indexBefore: string | null,
    indexAfter: string | null,
    checkpoint?: string | null,
    paths?: readonly string[],
    reader?: JsonReader);

  /**
   * Reads the entry from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The entry's path in error messages; `$` by default.
   * @returns The entry.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field or a value the protocol refuses.
   */
  public static fromJson(value: unknown, path?: string): GitJournalEntry;

  /**
   * Writes the entry's JSON form, with the fields `id`, `method`, `at`, `branch`, `branchAfter`, `moves`, `undo`, `indexBefore`, `indexAfter`, `checkpoint` and `paths`.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * The answer of `git.journal`: a repository's recent writes while the module runs, oldest first, at most 500.
 * @example
 * ```ts
 * import { GitJournal } from "@noldova/git.protocol";
 * export const empty: GitJournal = new GitJournal([]);
 * ```
 */
export declare class GitJournal {
  /**
   * The entries, at most 500.
   */
  public readonly entries: readonly GitJournalEntry[];

  /**
   * Whether a discard in the repository now takes a checkpoint first, so the journal can undo it: true while the app includes the
   * checkpoints module and it is on.
   */
  public readonly checkpoints: boolean;

  /**
   * Creates the journal.
   * @param entries The entries; at most 500.
   * @param checkpoints Whether a discard now takes a checkpoint first; false by default.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When it holds more than 50 entries.
   */
  public constructor(entries: readonly GitJournalEntry[], checkpoints?: boolean, reader?: JsonReader);

  /**
   * Reads the journal from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The journal's path in error messages; `$` by default.
   * @returns The journal.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, too many entries, or an entry the protocol refuses.
   */
  public static fromJson(value: unknown, path?: string): GitJournal;

  /**
   * Writes the journal's JSON form, with the fields `entries` and `checkpoints`.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * One git command a write ran, for the command log.
 * @example
 * ```ts
 * import { GitCommand } from "@noldova/git.protocol";
 * export const command: GitCommand = new GitCommand("1", "2026-11-22T18:05:00Z", "git push origin main:refs/heads/main", 0, 840);
 * ```
 */
export declare class GitCommand {
  /**
   * The command's id, unique while the module runs; not empty.
   */
  public readonly id: string;

  /**
   * When the command started, as an ISO 8601 date and time with its offset.
   */
  public readonly at: string;

  /**
   * The command line as the person could type it: `git`, then its arguments without the settings the module adds, each quoted where it needs to be,
   * with a URL's name and password taken out, its control characters replaced, and cut to 1000 characters; not empty.
   */
  public readonly line: string;

  /**
   * The command's exit code, or `null` when it ended without one, as when it timed out, was stopped or couldn't start.
   */
  public readonly exitCode: number | null;

  /**
   * How long the command ran, in whole milliseconds.
   */
  public readonly milliseconds: number;

  /**
   * Creates the command.
   * @param id The id; not empty, one line.
   * @param at When it started, as an ISO 8601 date and time with its offset.
   * @param line The command line; not empty, one line of at most 1000 characters.
   * @param exitCode The exit code, or `null`.
   * @param milliseconds How long it ran; a whole number of zero or more.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the id or the line is empty or not one line, the time isn't an ISO 8601 date and time, the exit code isn't
   * a whole number, or the time it ran isn't a whole number of zero or more.
   */
  public constructor(id: string, at: string, line: string, exitCode: number | null, milliseconds: number, reader?: JsonReader);

  /**
   * Reads the command from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The command's path in error messages; `$` by default.
   * @returns The command.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   */
  public static fromJson(value: unknown, path?: string): GitCommand;

  /**
   * Writes the command's JSON form, with the fields `id`, `at`, `line`, `exitCode` and `milliseconds`.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * The answer of `git.commandLog`: the git commands a repository's writes ran while the module runs, oldest first, at most 200.
 * @example
 * ```ts
 * import { GitCommandLog } from "@noldova/git.protocol";
 * export const empty: GitCommandLog = new GitCommandLog([]);
 * ```
 */
export declare class GitCommandLog {
  /**
   * The commands, at most 200.
   */
  public readonly commands: readonly GitCommand[];

  /**
   * Creates the log.
   * @param commands The commands; at most 200.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When it holds more than 200 commands.
   */
  public constructor(commands: readonly GitCommand[], reader?: JsonReader);

  /**
   * Reads the log from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The log's path in error messages; `$` by default.
   * @returns The log.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, too many commands, or a command the protocol refuses.
   */
  public static fromJson(value: unknown, path?: string): GitCommandLog;

  /**
   * Writes the log's JSON form, with the field `commands`.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of `git.undo`.
 * @example
 * ```ts
 * import { GitUndoParams } from "@noldova/git.protocol";
 * export const params: GitUndoParams = new GitUndoParams("/home/a/repo", "1", "fingerprint");
 * ```
 */
export declare class GitUndoParams {
  /**
   * The repository's folder, absolute.
   */
  public readonly folder: string;

  /**
   * The journal entry's id.
   */
  public readonly id: string;

  /**
   * The fingerprint of the status the person saw; a moved status refuses the write as stale.
   */
  public readonly basedOn: string;

  /**
   * Creates the parameters.
   * @param folder The repository's folder.
   * @param id The journal entry's id.
   * @param basedOn The status fingerprint.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When a field holds a value the protocol refuses.
   */
  public constructor(folder: string, id: string, basedOn: string, reader?: JsonReader);

  /**
   * Reads the parameters from their JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The parameters' path in error messages; `$` by default.
   * @returns The parameters.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field or a value the protocol refuses.
   */
  public static fromJson(value: unknown, path?: string): GitUndoParams;

  /**
   * Writes the parameters' JSON form, with the fields `folder`, `id` and `basedOn`.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of `git.reset`.
 * @example
 * ```ts
 * import { GitResetParams, ResetMode } from "@noldova/git.protocol";
 * export const params: GitResetParams = new GitResetParams("/home/a/repo", "0123456789abcdef0123456789abcdef01234567", ResetMode.Soft, "fingerprint");
 * ```
 */
export declare class GitResetParams {
  /**
   * The repository's folder, absolute.
   */
  public readonly folder: string;

  /**
   * The full id of the commit the current branch moves to.
   */
  public readonly id: string;

  /**
   * What the reset keeps.
   */
  public readonly mode: ResetMode;

  /**
   * The fingerprint of the status the person saw; a moved status refuses the write as stale.
   */
  public readonly basedOn: string;

  /**
   * Creates the parameters.
   * @param folder The repository's folder.
   * @param id The commit's full id.
   * @param mode What the reset keeps.
   * @param basedOn The status fingerprint.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When a field holds a value the protocol refuses.
   */
  public constructor(folder: string, id: string, mode: ResetMode, basedOn: string, reader?: JsonReader);

  /**
   * Reads the parameters from their JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The parameters' path in error messages; `$` by default.
   * @returns The parameters.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field or a value the protocol refuses.
   */
  public static fromJson(value: unknown, path?: string): GitResetParams;

  /**
   * Writes the parameters' JSON form, with the fields `folder`, `id`, `mode` and `basedOn`.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of `git.undoCommit`.
 * @example
 * ```ts
 * import { GitUndoCommitParams } from "@noldova/git.protocol";
 * export const params: GitUndoCommitParams = new GitUndoCommitParams("/home/a/repo", "fingerprint");
 * ```
 */
export declare class GitUndoCommitParams {
  /**
   * The repository's folder, absolute.
   */
  public readonly folder: string;

  /**
   * The fingerprint of the status the person saw; a moved status refuses the write as stale.
   */
  public readonly basedOn: string;

  /**
   * Creates the parameters.
   * @param folder The repository's folder.
   * @param basedOn The status fingerprint.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When a field holds a value the protocol refuses.
   */
  public constructor(folder: string, basedOn: string, reader?: JsonReader);

  /**
   * Reads the parameters from their JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The parameters' path in error messages; `$` by default.
   * @returns The parameters.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field or a value the protocol refuses.
   */
  public static fromJson(value: unknown, path?: string): GitUndoCommitParams;

  /**
   * Writes the parameters' JSON form, with the fields `folder` and `basedOn`.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of `git.forcePush`.
 * @example
 * ```ts
 * import { GitForcePushParams } from "@noldova/git.protocol";
 * export const params: GitForcePushParams = new GitForcePushParams("/home/a/repo", "0123456789abcdef0123456789abcdef01234567", "fingerprint");
 * ```
 */
export declare class GitForcePushParams {
  /**
   * The repository's folder, absolute.
   */
  public readonly folder: string;

  /**
   * The full id of the commit the person saw on the remote's branch; the remote refuses the push once its branch has moved from it.
   */
  public readonly expected: string;

  /**
   * The fingerprint of the status the person saw; a moved status refuses the write as stale.
   */
  public readonly basedOn: string;

  /**
   * Creates the parameters.
   * @param folder The repository's folder.
   * @param expected The commit the person saw on the remote's branch.
   * @param basedOn The status fingerprint.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When a field holds a value the protocol refuses.
   */
  public constructor(folder: string, expected: string, basedOn: string, reader?: JsonReader);

  /**
   * Reads the parameters from their JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The parameters' path in error messages; `$` by default.
   * @returns The parameters.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field or a value the protocol refuses.
   */
  public static fromJson(value: unknown, path?: string): GitForcePushParams;

  /**
   * Writes the parameters' JSON form, with the fields `folder`, `expected` and `basedOn`.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}
/**
 * How `git.resolveConflict` resolves an unmerged path.
 * @example
 * ```ts
 * import { ConflictResolution } from "@noldova/git.protocol";
 * export function keepsAFile(resolution: ConflictResolution): boolean {
 *   return resolution !== ConflictResolution.Delete;
 * }
 * ```
 */
export declare const ConflictResolution: {
  /**
   * Writes the given text to the file and stages it; refused while the text still has a conflict marker line.
   */
  readonly Text: "Text";

  /**
   * Takes our whole side of the file and stages it, dropping every change of theirs in it.
   */
  readonly Ours: "Ours";

  /**
   * Takes their whole side of the file and stages it, dropping every change of ours in it.
   */
  readonly Theirs: "Theirs";

  /**
   * Removes the file and stages its removal.
   */
  readonly Delete: "Delete";
};

/**
 * One of {@link ConflictResolution}'s wire values.
 */
export type ConflictResolution = (typeof ConflictResolution)[keyof typeof ConflictResolution];

/**
 * The parameters of `git.conflict`: the folder and the unmerged path to read.
 * @example
 * ```ts
 * import { GitConflictParams } from "@noldova/git.protocol";
 * export const params: GitConflictParams = new GitConflictParams("/srv/repo", "src/a.ts");
 * ```
 */
export declare class GitConflictParams {
  /**
   * The repository's folder, an absolute POSIX, drive or UNC path of at most 4096 characters; untrusted.
   */
  public readonly folder: string;

  /**
   * The unmerged path, relative to the repository's top folder; untrusted.
   */
  public readonly path: string;

  /**
   * Creates the parameters.
   * @param folder The folder; absolute, at most 4096 characters.
   * @param path The path; relative, without a `..` segment or a NUL, and not starting with a drive letter and a colon, a colon or a backslash.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the folder isn't absolute or is too long, or the path isn't a relative path inside the repository.
   * @example
   * ```ts
   * import { GitConflictParams } from "@noldova/git.protocol";
   * export const params: GitConflictParams = new GitConflictParams("C:\\work\\repo", "README.md");
   * ```
   */
  public constructor(folder: string, path: string, reader?: JsonReader);

  /**
   * Reads the parameters from their JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The parameters' path in error messages; `$` by default.
   * @returns The parameters.
   * @throws {JsonException} When the value isn't an object, or a field is missing or not a text; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   * @example
   * ```ts
   * import { GitConflictParams } from "@noldova/git.protocol";
   * export const params: GitConflictParams = GitConflictParams.fromJson({ folder: "/srv/repo", path: "src/a.ts" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): GitConflictParams;

  /**
   * Writes the parameters' JSON form, with the fields `folder` and `path`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { GitConflictParams } from "@noldova/git.protocol";
   * export const json = new GitConflictParams("/srv/repo", "src/a.ts").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * One unmerged path as `git.conflict` reads it: its kind, the texts of its stages, and git's merged text with zdiff3 conflict markers.
 * A stage the kind doesn't have is `null`, and so is every text of a binary file.
 * @example
 * ```ts
 * import { type GitConflict } from "@noldova/git.protocol";
 * export function hasTextMerge(conflict: GitConflict): boolean {
 *   return conflict.merged !== null;
 * }
 * ```
 */
export declare class GitConflict {
  /**
   * The path, relative to the repository's top folder; untrusted.
   */
  public readonly path: string;

  /**
   * How the path conflicts, by which sides changed it.
   */
  public readonly kind: ConflictKind;

  /**
   * The operation in progress, or `null` when the index is unmerged with none, such as after `git stash pop`.
   */
  public readonly operation: OperationKind | null;

  /**
   * The common ancestor's text, stage 1, or `null` when the kind has no base or the file is binary; untrusted.
   */
  public readonly base: string | null;

  /**
   * Our side's text, stage 2, or `null` when our side deleted the file or it is binary; untrusted.
   * During a rebase, this is the branch being rebased onto.
   */
  public readonly ours: string | null;

  /**
   * Their side's text, stage 3, or `null` when their side deleted the file or it is binary; untrusted.
   * During a rebase, this is the commit being replayed.
   */
  public readonly theirs: string | null;

  /**
   * Git's merge of the three with zdiff3 conflict markers, a text exactly when ours and theirs both are; untrusted.
   * When {@link GitConflict.reused} is true, it is the worktree's text, which a recorded resolution already merged.
   */
  public readonly merged: string | null;

  /**
   * The name shown for our side, such as `main` or, during a rebase, `onto main`; untrusted.
   */
  public readonly oursLabel: string;

  /**
   * The name shown for their side, such as a branch or, during a rebase, `your commit abc1234`; untrusted.
   */
  public readonly theirsLabel: string;

  /**
   * The full id of the commit our side comes from: the commit at `HEAD`, in every operation, a rebase's too; `null` when `HEAD` has no commit
   * yet, or in a conflict an older runtime read.
   */
  public readonly oursCommit: string | null;

  /**
   * The full id of the commit their side comes from: `MERGE_HEAD` in a merge, `CHERRY_PICK_HEAD` in a cherry-pick, `REVERT_HEAD`, the reverted
   * commit, in a revert, and `REBASE_HEAD`, the commit being replayed, in a rebase; `null` with no operation, or in a conflict an older runtime read.
   */
  public readonly theirsCommit: string | null;

  /**
   * Whether a present stage isn't text or is too large to merge as text; then only whole-side choices are offered.
   */
  public readonly binary: boolean;

  /**
   * Whether git's recorded resolutions already merged the file, so it has no markers while it is still unmerged, and the person checks it.
   */
  public readonly reused: boolean;

  /**
   * Creates the conflict.
   * @param path The path; relative.
   * @param kind The kind.
   * @param operation The operation in progress, or `null`.
   * @param base The base's text, or `null`.
   * @param ours Our side's text, or `null`.
   * @param theirs Their side's text, or `null`.
   * @param merged The merged text, or `null`.
   * @param oursLabel Our side's name; a line that isn't empty.
   * @param theirsLabel Their side's name; a line that isn't empty.
   * @param oursCommit Our side's commit, a full object id, or `null`.
   * @param theirsCommit Their side's commit, a full object id, or `null`.
   * @param binary Whether the file is binary.
   * @param reused Whether a recorded resolution merged it.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the path isn't relative, a text is present that the kind or a binary file doesn't have or missing that it has,
   *   the merged text is present without both sides or missing with them, the conflict is reused without a merged text, a label is empty or not one line,
   *   or a commit isn't a full object id.
   * @example
   * ```ts
   * import { ConflictKind, GitConflict, OperationKind } from "@noldova/git.protocol";
   * export const conflict: GitConflict = new GitConflict("a.ts", ConflictKind.DeletedByUs, OperationKind.Merge, "old\n", null, "new\n", null, "main",
   *   "feature", "a".repeat(40), "b".repeat(40), false, false);
   * ```
   */
  public constructor(path: string, kind: ConflictKind, operation: OperationKind | null, base: string | null, ours: string | null, theirs: string | null,
    merged: string | null, oursLabel: string, theirsLabel: string, oursCommit: string | null, theirsCommit: string | null, binary: boolean, reused: boolean,
    reader?: JsonReader);

  /**
   * Reads the conflict from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The conflict's path in error messages; `$` by default.
   * @returns The conflict.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   * @example
   * ```ts
   * import { GitConflict } from "@noldova/git.protocol";
   * export function read(json: unknown): GitConflict {
   *   return GitConflict.fromJson(json);
   * }
   * ```
   */
  public static fromJson(value: unknown, path?: string): GitConflict;

  /**
   * Writes the conflict's JSON form, with the fields `path`, `kind`, `operation`, `base`, `ours`, `theirs`, `merged`, `oursLabel`, `theirsLabel`,
   * `oursCommit`, `theirsCommit`, `binary` and `reused`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { type GitConflict } from "@noldova/git.protocol";
   * export function send(conflict: GitConflict): string {
   *   return JSON.stringify(conflict.toJson());
   * }
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of `git.resolveConflict`: the folder, the unmerged path, how to resolve it, the text for a `Text` resolution, and the status it is
 * based on.
 * @example
 * ```ts
 * import { ConflictResolution, GitResolveParams } from "@noldova/git.protocol";
 * export const params: GitResolveParams = new GitResolveParams("/srv/repo", "a.ts", ConflictResolution.Theirs, null, "4f2a");
 * ```
 */
export declare class GitResolveParams {
  /**
   * The repository's folder, an absolute POSIX, drive or UNC path of at most 4096 characters; untrusted.
   */
  public readonly folder: string;

  /**
   * The unmerged path, relative to the repository's top folder; untrusted.
   */
  public readonly path: string;

  /**
   * How to resolve the path.
   */
  public readonly resolution: ConflictResolution;

  /**
   * The file's new text for a `Text` resolution, possibly empty, and `null` for every other; untrusted.
   */
  public readonly text: string | null;

  /**
   * The fingerprint of the status the caller showed; the call fails as `Stale` when it has moved.
   */
  public readonly basedOn: string;

  /**
   * Creates the parameters.
   * @param folder The folder; absolute, at most 4096 characters.
   * @param path The path; relative, without a `..` segment or a NUL, and not starting with a drive letter and a colon, a colon or a backslash.
   * @param resolution How to resolve it.
   * @param text The text exactly when the resolution is `Text`, else `null`.
   * @param basedOn The status's fingerprint; not empty.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the folder or path is invalid, a text comes with a resolution other than `Text` or is missing with it, or
   *   the fingerprint is empty.
   * @example
   * ```ts
   * import { ConflictResolution, GitResolveParams } from "@noldova/git.protocol";
   * export const params: GitResolveParams = new GitResolveParams("C:\\work\\repo", "a.ts", ConflictResolution.Text, "merged\n", "4f2a");
   * ```
   */
  public constructor(folder: string, path: string, resolution: ConflictResolution, text: string | null, basedOn: string, reader?: JsonReader);

  /**
   * Reads the parameters from their JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The parameters' path in error messages; `$` by default.
   * @returns The parameters.
   * @throws {JsonException} When the value isn't an object, a field is missing or of the wrong type, or the resolution isn't one of
   *   {@link ConflictResolution}'s values; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   * @example
   * ```ts
   * import { GitResolveParams } from "@noldova/git.protocol";
   * export const params: GitResolveParams = GitResolveParams.fromJson({ folder: "/srv/repo", path: "a.ts", resolution: "Delete", text: null,
   *   basedOn: "4f2a" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): GitResolveParams;

  /**
   * Writes the parameters' JSON form, with the fields `folder`, `path`, `resolution`, `text` and `basedOn`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { ConflictResolution, GitResolveParams } from "@noldova/git.protocol";
   * export const json = new GitResolveParams("/srv/repo", "a.ts", ConflictResolution.Ours, null, "4f2a").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of `git.continueOperation`, `git.abortOperation` and `git.skipOperation`: the folder and the status they are based on.
 * @example
 * ```ts
 * import { GitOperationParams } from "@noldova/git.protocol";
 * export const params: GitOperationParams = new GitOperationParams("/srv/repo", "4f2a");
 * ```
 */
export declare class GitOperationParams {
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
   * import { GitOperationParams } from "@noldova/git.protocol";
   * export const params: GitOperationParams = new GitOperationParams("C:\\work\\repo", "4f2a");
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
   * import { GitOperationParams } from "@noldova/git.protocol";
   * export const params: GitOperationParams = GitOperationParams.fromJson({ folder: "/srv/repo", basedOn: "4f2a" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): GitOperationParams;

  /**
   * Writes the parameters' JSON form, with the fields `folder` and `basedOn`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { GitOperationParams } from "@noldova/git.protocol";
   * export const json = new GitOperationParams("/srv/repo", "4f2a").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The write a prediction is for.
 * @example
 * ```ts
 * import { PredictionAction } from "@noldova/git.protocol";
 * export const action: PredictionAction = PredictionAction.Merge;
 * ```
 */
export declare const PredictionAction: {
  /**
   * Merging the commit into the current branch.
   */
  readonly Merge: "Merge";
  /**
   * Cherry-picking the commit onto the current branch, a merge against its first parent.
   */
  readonly CherryPick: "CherryPick";
  /**
   * Reverting the commit on the current branch, a merge against its first parent.
   */
  readonly Revert: "Revert";
};

export type PredictionAction = (typeof PredictionAction)[keyof typeof PredictionAction];

/**
 * What a write would do, worked out without touching the working folder or the index.
 * @example
 * ```ts
 * import { PredictionOutcome } from "@noldova/git.protocol";
 * export function isSafe(outcome: PredictionOutcome): boolean {
 *   return outcome !== PredictionOutcome.Conflicts && outcome !== PredictionOutcome.Unavailable;
 * }
 * ```
 */
export declare const PredictionOutcome: {
  /**
   * Nothing would change: the commit is already in the current branch, or its change already is.
   */
  readonly UpToDate: "UpToDate";
  /**
   * A merge would only move the current branch forward to the commit.
   */
  readonly FastForward: "FastForward";
  /**
   * The write would make its commit without a conflict.
   */
  readonly Clean: "Clean";
  /**
   * The write would stop on conflicts in the prediction's paths.
   */
  readonly Conflicts: "Conflicts";
  /**
   * The prediction can't be made, such as for a root commit's cherry-pick or with a git older than 2.40.
   */
  readonly Unavailable: "Unavailable";
};

export type PredictionOutcome = (typeof PredictionOutcome)[keyof typeof PredictionOutcome];

/**
 * Whether a commit's signature checks out against the keys the person trusts.
 * @example
 * ```ts
 * import { SignatureState } from "@noldova/git.protocol";
 * export function isTrusted(state: SignatureState): boolean {
 *   return state === SignatureState.Verified;
 * }
 * ```
 */
export declare const SignatureState: {
  /**
   * The signature is good, and its key is one the person trusts.
   */
  readonly Verified: "Verified";
  /**
   * The commit is signed, but the signature is bad, expired, revoked, by a key the person doesn't trust, or can't be checked.
   */
  readonly Unverified: "Unverified";
  /**
   * The commit carries no signature.
   */
  readonly None: "None";
};

export type SignatureState = (typeof SignatureState)[keyof typeof SignatureState];

/**
 * The answer of `git.commitSignature`: whether a commit's signature checks out, and who signed it with which key.
 * @example
 * ```ts
 * import { GitCommitSignature, SignatureState } from "@noldova/git.protocol";
 * export const signature: GitCommitSignature = new GitCommitSignature("0123456789abcdef0123456789abcdef01234567", SignatureState.Verified,
 *   "A Person <a@example.com>", "SHA256:abc");
 * ```
 */
export declare class GitCommitSignature {
  /**
   * The commit's full id.
   */
  public readonly id: string;

  /**
   * Whether the signature checks out.
   */
  public readonly state: SignatureState;

  /**
   * Who signed it, as the signature names them; untrusted, and `null` for an unsigned commit or when git can't name them.
   */
  public readonly signer: string | null;

  /**
   * The key it was signed with, as git names it; untrusted, and `null` for an unsigned commit or when git can't name it.
   */
  public readonly key: string | null;

  /**
   * Creates the signature.
   * @param id The commit's full id.
   * @param state Whether it checks out.
   * @param signer The signer; one line, not empty, and `null` when the state is `None`.
   * @param key The key; one line, not empty, and `null` when the state is `None`.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When a value breaks its rule above.
   */
  public constructor(id: string, state: SignatureState, signer: string | null, key: string | null, reader?: JsonReader);

  /**
   * Reads the signature from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The signature's path in error messages; `$` by default.
   * @returns The signature.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   */
  public static fromJson(value: unknown, path?: string): GitCommitSignature;

  /**
   * Writes the signature's JSON form, with the fields `id`, `state`, `signer` and `key`.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * The format git signs a commit in, as `gpg.format` names it.
 * @example
 * ```ts
 * import { SigningFormat } from "@noldova/git.protocol";
 * export function usesSsh(format: SigningFormat | null): boolean {
 *   return format === SigningFormat.Ssh;
 * }
 * ```
 */
export declare const SigningFormat: {
  /**
   * OpenPGP, through `gpg`; git's default when `gpg.format` isn't set.
   */
  readonly OpenPgp: "OpenPgp";
  /**
   * SSH, through `ssh-keygen`.
   */
  readonly Ssh: "Ssh";
  /**
   * X.509, through `gpgsm`.
   */
  readonly X509: "X509";
};

export type SigningFormat = (typeof SigningFormat)[keyof typeof SigningFormat];

/**
 * The answer of `git.commitSigning`: whether git signs a new commit in the repository, and the format it signs in.
 * @example
 * ```ts
 * import { GitCommitSigning, SigningFormat } from "@noldova/git.protocol";
 * export const signing: GitCommitSigning = new GitCommitSigning(true, SigningFormat.Ssh);
 * ```
 */
export declare class GitCommitSigning {
  /**
   * Whether git signs a new commit: `commit.gpgsign` as git reads it, false when it isn't set.
   */
  public readonly signs: boolean;

  /**
   * The format git signs in: `gpg.format`, `OpenPgp` when it isn't set, and `null` for a value git doesn't know and refuses to sign with.
   */
  public readonly format: SigningFormat | null;

  /**
   * Creates the answer.
   * @param signs Whether git signs a new commit.
   * @param format The format, or `null` for one git doesn't know.
   */
  public constructor(signs: boolean, format: SigningFormat | null);

  /**
   * Reads the answer from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The answer's path in error messages; `$` by default.
   * @returns The answer.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field.
   * @example
   * ```ts
   * import { GitCommitSigning } from "@noldova/git.protocol";
   * export const signing: GitCommitSigning = GitCommitSigning.fromJson({ signs: true, format: "Ssh" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): GitCommitSigning;

  /**
   * Writes the answer's JSON form, with the fields `signs` and `format`.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of `git.predict`.
 * @example
 * ```ts
 * import { GitPredictParams, PredictionAction } from "@noldova/git.protocol";
 * export const params: GitPredictParams = new GitPredictParams("/home/a/repo", "0123456789abcdef0123456789abcdef01234567", PredictionAction.Merge);
 * ```
 */
export declare class GitPredictParams {
  /**
   * The repository's folder, absolute.
   */
  public readonly folder: string;

  /**
   * The full id of the commit to merge, cherry-pick or revert.
   */
  public readonly id: string;

  /**
   * The write the prediction is for.
   */
  public readonly action: PredictionAction;

  /**
   * Creates the parameters.
   * @param folder The repository's folder.
   * @param id The commit's full id.
   * @param action The write the prediction is for.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When a field holds a value the protocol refuses.
   */
  public constructor(folder: string, id: string, action: PredictionAction, reader?: JsonReader);

  /**
   * Reads the parameters from their JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The parameters' path in error messages; `$` by default.
   * @returns The parameters.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field or a value the protocol refuses.
   */
  public static fromJson(value: unknown, path?: string): GitPredictParams;

  /**
   * Writes the parameters' JSON form, with the fields `folder`, `id` and `action`.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * `git.predict`'s answer.
 * @example
 * ```ts
 * import { GitPrediction, PredictionOutcome } from "@noldova/git.protocol";
 * export const prediction: GitPrediction = new GitPrediction(PredictionOutcome.Conflicts, ["src/app.ts"]);
 * ```
 */
export declare class GitPrediction {
  /**
   * What the write would do.
   */
  public readonly outcome: PredictionOutcome;

  /**
   * The paths that would conflict, relative to the repository's top folder; from the repository and untrusted; empty unless the outcome is `Conflicts`.
   */
  public readonly paths: readonly string[];

  /**
   * Creates the answer.
   * @param outcome What the write would do.
   * @param paths The paths that would conflict; at least one exactly when the outcome is `Conflicts`.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the paths don't match the outcome or a path isn't a relative path.
   */
  public constructor(outcome: PredictionOutcome, paths: readonly string[], reader?: JsonReader);

  /**
   * Reads the answer from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The answer's path in error messages; `$` by default.
   * @returns The answer.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field or a value the protocol refuses.
   */
  public static fromJson(value: unknown, path?: string): GitPrediction;

  /**
   * Writes the answer's JSON form, with the fields `outcome` and `paths`.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of `git.stash`: the folder, the stash's message or none, whether it takes untracked files, and the status it is based on.
 * @example
 * ```ts
 * import { GitStashParams } from "@noldova/git.protocol";
 * export const params: GitStashParams = new GitStashParams("/home/a/repo", null, true, "4f2a");
 * ```
 */
export declare class GitStashParams {
  /**
   * The repository's folder, an absolute POSIX, drive or UNC path of at most 4096 characters; untrusted.
   */
  public readonly folder: string;

  /**
   * The stash's message, one line, or null for git's own.
   */
  public readonly message: string | null;

  /**
   * Whether the stash takes untracked files too, `--include-untracked`.
   */
  public readonly includeUntracked: boolean;

  /**
   * The fingerprint of the status the caller showed; the call fails as `Stale` when it has moved.
   */
  public readonly basedOn: string;

  /**
   * Creates the parameters.
   * @param folder The folder; absolute, at most 4096 characters.
   * @param message The message, one line without control characters, or null.
   * @param includeUntracked Whether to take untracked files too.
   * @param basedOn The status's fingerprint; not empty.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the folder isn't absolute or is too long, the message is empty or not one line, or the fingerprint is empty.
   */
  public constructor(folder: string, message: string | null, includeUntracked: boolean, basedOn: string, reader?: JsonReader);

  /**
   * Reads the parameters from their JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The parameters' path in error messages; `$` by default.
   * @returns The parameters.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   */
  public static fromJson(value: unknown, path?: string): GitStashParams;

  /**
   * Writes the parameters' JSON form, with the fields `folder`, `message`, `includeUntracked` and `basedOn`.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of `git.fetch`: the folder and the status it is based on.
 * @example
 * ```ts
 * import { GitFetchParams } from "@noldova/git.protocol";
 * export const params: GitFetchParams = new GitFetchParams("/home/a/repo", "4f2a");
 * ```
 */
export declare class GitFetchParams {
  /**
   * The repository's folder, an absolute POSIX, drive or UNC path of at most 4096 characters; untrusted.
   */
  public readonly folder: string;

  /**
   * The fingerprint of the status the caller showed; the call fails as `Stale` when it has moved.
   */
  public readonly basedOn: string;

  /**
   * Whether the fetch is of every remote, `git fetch --all`, rather than the current branch's; its JSON leaves the field out when false, and a
   * missing field reads as false.
   */
  public readonly allRemotes: boolean;

  /**
   * Creates the parameters.
   * @param folder The folder; absolute, at most 4096 characters.
   * @param basedOn The status's fingerprint; not empty.
   * @param allRemotes Whether to fetch every remote; false by default.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the folder isn't absolute or is too long, or the fingerprint is empty.
   * @example
   * ```ts
   * import { GitFetchParams } from "@noldova/git.protocol";
   * export const params: GitFetchParams = new GitFetchParams("C:\\work\\repo", "4f2a");
   * ```
   */
  public constructor(folder: string, basedOn: string, allRemotes?: boolean, reader?: JsonReader);

  /**
   * Reads the parameters from their JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The parameters' path in error messages; `$` by default.
   * @returns The parameters.
   * @throws {JsonException} When the value isn't an object, or a field is missing or not a text; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   * @example
   * ```ts
   * import { GitFetchParams } from "@noldova/git.protocol";
   * export const params: GitFetchParams = GitFetchParams.fromJson({ folder: "/home/a/repo", basedOn: "4f2a" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): GitFetchParams;

  /**
   * Writes the parameters' JSON form, with the fields `folder` and `basedOn`, and `allRemotes` only when true.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { GitFetchParams, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new GitFetchParams("/home/a/repo", "4f2a").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * What an interactive rebase does with one of the branch's commits.
 * @example
 * ```ts
 * import { RebaseAction } from "@noldova/git.protocol";
 * export const action: RebaseAction = RebaseAction.Fixup;
 * ```
 */
export declare const RebaseAction: {
  /**
   * Replays the commit as it is.
   */
  readonly Pick: "Pick";
  /**
   * Replays the commit with the step's message.
   */
  readonly Reword: "Reword";
  /**
   * Replays the commit and stops after it, so the person can change it before continuing.
   */
  readonly Edit: "Edit";
  /**
   * Folds the commit into the step before it, committing the step's message for the whole.
   */
  readonly Squash: "Squash";
  /**
   * Folds the commit into the step before it, keeping that step's message.
   */
  readonly Fixup: "Fixup";
  /**
   * Leaves the commit out.
   */
  readonly Drop: "Drop";
};

export type RebaseAction = (typeof RebaseAction)[keyof typeof RebaseAction];

/**
 * What a rebase step would do, worked out before the rebase starts, without touching the branch, the index or the working folder.
 * @example
 * ```ts
 * import { RebaseCheckOutcome } from "@noldova/git.protocol";
 * export const outcome: RebaseCheckOutcome = RebaseCheckOutcome.Clean;
 * ```
 */
export declare const RebaseCheckOutcome: {
  /**
   * The step applies without a conflict.
   */
  readonly Clean: "Clean";
  /**
   * The step stops on a conflict in the check's paths.
   */
  readonly Conflicts: "Conflicts";
  /**
   * The step folds into the step before it without a conflict.
   */
  readonly Folded: "Folded";
  /**
   * The step is left out.
   */
  readonly Dropped: "Dropped";
  /**
   * Git can't tell, such as when a merge driver or a file too large to merge in memory is involved.
   */
  readonly Unavailable: "Unavailable";
};

export type RebaseCheckOutcome = (typeof RebaseCheckOutcome)[keyof typeof RebaseCheckOutcome];

/**
 * One row of an interactive rebase: the commit's full id, what to do with it, and the message a Reword or a Squash commits, which only those two
 * carry; a Squash's message is the whole squashed commit's.
 * @example
 * ```ts
 * import { RebaseAction, RebaseStep } from "@noldova/git.protocol";
 * export const step: RebaseStep = new RebaseStep("0123456789abcdef0123456789abcdef01234567", RebaseAction.Reword, "Draw lanes on a canvas");
 * ```
 */
export declare class RebaseStep {
  /**
   * The commit's full id.
   */
  public readonly id: string;

  /**
   * What the rebase does with the commit.
   */
  public readonly action: RebaseAction;

  /**
   * The message a Reword or a Squash commits; `null` for the other actions.
   */
  public readonly message: string | null;

  /**
   * @param id The commit's full id.
   * @param action What the rebase does with the commit.
   * @param message The message a Reword or a Squash commits, not blank and without NUL; `null` for the other actions.
   * @param reader The reader a field's failure names; given when read from JSON.
   * @throws {ProtocolFieldException} When a field is out of range.
   */
  public constructor(id: string, action: RebaseAction, message: string | null, reader?: JsonReader);

  /**
   * Reads a step from JSON.
   * @throws {JsonException} When the JSON isn't the step's shape.
   * @throws {ProtocolFieldException} When a field is out of range or unknown.
   */
  public static fromJson(value: unknown, path?: string): RebaseStep;

  /**
   * Checks a rebase's steps: at least one and at most 500, each commit once, and no Squash or Fixup before a step it can fold into.
   * @throws {ProtocolFieldException} When the steps break one of those rules.
   */
  public static requireSteps(steps: readonly RebaseStep[], reader?: JsonReader): void;

  /**
   * Writes the step as JSON.
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of `git.rebasePlan`: the folder and the full id of the commit the current branch would be rebased onto.
 * @example
 * ```ts
 * import { GitRebasePlanParams } from "@noldova/git.protocol";
 * export const params: GitRebasePlanParams = new GitRebasePlanParams("/home/a/repo", "0123456789abcdef0123456789abcdef01234567");
 * ```
 */
export declare class GitRebasePlanParams {
  /**
   * The repository's folder, absolute.
   */
  public readonly folder: string;

  /**
   * The full id of the commit to rebase onto.
   */
  public readonly onto: string;

  /**
   * @throws {ProtocolFieldException} When a field is out of range.
   */
  public constructor(folder: string, onto: string, reader?: JsonReader);

  /**
   * Reads the parameters from JSON.
   * @throws {JsonException} When the JSON isn't the parameters' shape.
   * @throws {ProtocolFieldException} When a field is out of range or unknown.
   */
  public static fromJson(value: unknown, path?: string): GitRebasePlanParams;

  /**
   * Writes the parameters as JSON.
   */
  public toJson(): JsonObject;
}

/**
 * One of the commits a rebase would replay: its full id, its whole message, and for a `fixup!` or `squash!` commit the full id of the earlier
 * commit in the rebase that its subject names, or `null`.
 * @example
 * ```ts
 * import { GitRebaseCommit } from "@noldova/git.protocol";
 * export const commit: GitRebaseCommit = new GitRebaseCommit("0123456789abcdef0123456789abcdef01234567", "Draw lanes on a canvas", null);
 * ```
 */
export declare class GitRebaseCommit {
  /**
   * The commit's full id.
   */
  public readonly id: string;

  /**
   * The commit's whole message.
   */
  public readonly message: string;

  /**
   * For a `fixup!` or `squash!` commit, the full id of the earlier commit in the rebase that its subject names; otherwise `null`.
   */
  public readonly fixupOf: string | null;

  /**
   * @throws {ProtocolFieldException} When a field is out of range.
   */
  public constructor(id: string, message: string, fixupOf: string | null, reader?: JsonReader);

  /**
   * The message's first line.
   */
  public get subject(): string;

  /**
   * Reads a commit from JSON.
   * @throws {JsonException} When the JSON isn't the commit's shape.
   * @throws {ProtocolFieldException} When a field is out of range or unknown.
   */
  public static fromJson(value: unknown, path?: string): GitRebaseCommit;

  /**
   * Writes the commit as JSON.
   */
  public toJson(): JsonObject;
}

/**
 * `git.rebasePlan`'s answer: the current branch, or `null` on a detached HEAD; the commit it would go onto and the merge base; how many commits
 * the target has past the base; the commits to replay, oldest first; the other local branches that point at one of them, which `updateRefs` moves
 * too; and whether the branch's upstream already has any of them, so the rebase rewrites pushed history.
 * @example
 * ```ts
 * import { GitRebasePlan } from "@noldova/git.protocol";
 * export const plan: GitRebasePlan = new GitRebasePlan("feature", "c".repeat(40), "b".repeat(40), 0, [], [], false);
 * ```
 */
export declare class GitRebasePlan {
  /**
   * The current branch's short name, or `null` on a detached HEAD.
   */
  public readonly branch: string | null;

  /**
   * The full id of the commit the branch would go onto.
   */
  public readonly onto: string;

  /**
   * The full id of the merge base of the branch and the target.
   */
  public readonly base: string;

  /**
   * How many commits the target has past the merge base.
   */
  public readonly ontoAhead: number;

  /**
   * The commits the rebase would replay, oldest first, at most 500.
   */
  public readonly commits: readonly GitRebaseCommit[];

  /**
   * The other local branches that point at one of the replayed commits.
   */
  public readonly stacked: readonly string[];

  /**
   * Whether the branch's upstream already has one of the replayed commits.
   */
  public readonly pushed: boolean;

  /**
   * @throws {ProtocolFieldException} When a field is out of range.
   */
  public constructor(branch: string | null, onto: string, base: string, ontoAhead: number, commits: readonly GitRebaseCommit[], stacked: readonly string[],
    pushed: boolean, reader?: JsonReader);

  /**
   * Reads a plan from JSON.
   * @throws {JsonException} When the JSON isn't the plan's shape.
   * @throws {ProtocolFieldException} When a field is out of range or unknown.
   */
  public static fromJson(value: unknown, path?: string): GitRebasePlan;

  /**
   * Writes the plan as JSON.
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of `git.rebaseCheck`: the folder, the full id of the commit to rebase onto, and the steps in the order they would run.
 * @example
 * ```ts
 * import { GitRebaseCheckParams, RebaseAction, RebaseStep } from "@noldova/git.protocol";
 * export const params: GitRebaseCheckParams = new GitRebaseCheckParams("/home/a/repo", "c".repeat(40), [new RebaseStep("a".repeat(40), RebaseAction.Pick, null)]);
 * ```
 */
export declare class GitRebaseCheckParams {
  /**
   * The repository's folder, absolute.
   */
  public readonly folder: string;

  /**
   * The full id of the commit to rebase onto.
   */
  public readonly onto: string;

  /**
   * The steps in the order they would run.
   */
  public readonly steps: readonly RebaseStep[];

  /**
   * @throws {ProtocolFieldException} When a field is out of range or the steps break {@link RebaseStep.requireSteps}.
   */
  public constructor(folder: string, onto: string, steps: readonly RebaseStep[], reader?: JsonReader);

  /**
   * Reads the parameters from JSON.
   * @throws {JsonException} When the JSON isn't the parameters' shape.
   * @throws {ProtocolFieldException} When a field is out of range or unknown.
   */
  public static fromJson(value: unknown, path?: string): GitRebaseCheckParams;

  /**
   * Writes the parameters as JSON.
   */
  public toJson(): JsonObject;
}

/**
 * What one step would do: its outcome, and the paths that would conflict, which only `Conflicts` has.
 * @example
 * ```ts
 * import { GitRebaseStepCheck, RebaseCheckOutcome } from "@noldova/git.protocol";
 * export const check: GitRebaseStepCheck = new GitRebaseStepCheck(RebaseCheckOutcome.Conflicts, ["src/a.ts"]);
 * ```
 */
export declare class GitRebaseStepCheck {
  /**
   * What the step would do.
   */
  public readonly outcome: RebaseCheckOutcome;

  /**
   * The paths that would conflict, relative to the repository's top; empty unless the outcome is `Conflicts`.
   */
  public readonly paths: readonly string[];

  /**
   * @throws {ProtocolFieldException} When a field is out of range.
   */
  public constructor(outcome: RebaseCheckOutcome, paths: readonly string[], reader?: JsonReader);

  /**
   * Reads a check from JSON.
   * @throws {JsonException} When the JSON isn't the check's shape.
   * @throws {ProtocolFieldException} When a field is out of range or unknown.
   */
  public static fromJson(value: unknown, path?: string): GitRebaseStepCheck;

  /**
   * Writes the check as JSON.
   */
  public toJson(): JsonObject;
}

/**
 * `git.markerCheck`'s answer: the tracked files, staged or not, that still have a conflict marker line, as `git diff --check` finds them, each once.
 * @example
 * ```ts
 * import { GitMarkerCheck } from "@noldova/git.protocol";
 * export const check: GitMarkerCheck = new GitMarkerCheck(["src/history.reader.ts"]);
 * ```
 */
export declare class GitMarkerCheck {
  /**
   * The files' paths, relative to the repository's top folder, each once.
   */
  public readonly paths: readonly string[];

  /**
   * @throws {ProtocolFieldException} When there are more than 10000 paths, or a path isn't a relative path in the repository.
   */
  public constructor(paths: readonly string[], reader?: JsonReader);

  /**
   * Reads the check from JSON.
   * @throws {JsonException} When the JSON isn't the check's shape.
   * @throws {ProtocolFieldException} When a field is out of range or unknown.
   */
  public static fromJson(value: unknown, path?: string): GitMarkerCheck;

  /**
   * Writes the check as JSON.
   */
  public toJson(): JsonObject;
}

/**
 * A commit in the answer of `git.messageReferences`: its id and the numbers of the references its message names, in the order the message first
 * names them.
 * @example
 * ```ts
 * import { GitMessageReference } from "@noldova/git.protocol";
 * export const reference: GitMessageReference = new GitMessageReference("0123456789abcdef0123456789abcdef01234567", [7531]);
 * ```
 */
export declare class GitMessageReference {
  /**
   * The commit's full object id.
   */
  public readonly id: string;

  /**
   * The references' numbers, at least one, each from 1 to 9999999999.
   */
  public readonly numbers: readonly number[];

  /**
   * Creates the commit's references, keeping its own copy of the numbers.
   * @param id The commit's full object id.
   * @param numbers The numbers; at least one, each from 1 to 9999999999.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the id isn't an object id, there are no numbers, or a number is out of range or not whole.
   */
  public constructor(id: string, numbers: readonly number[], reader?: JsonReader);

  /**
   * Reads the commit's references from their JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The value's path in error messages; `$` by default.
   * @returns The commit's references.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   */
  public static fromJson(value: unknown, path?: string): GitMessageReference;

  /**
   * Writes the JSON form, with the fields `id` and `numbers`.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * The answer of `git.mergedBranches`: the branch the first remote's HEAD names, in `git remote`'s order, and the local branches whose tips it holds, so a view
 * can leave out branches whose work already landed.
 * @example
 * ```ts
 * import type { GitMergedBranches } from "@noldova/git.protocol";
 * export function isMerged(merged: GitMergedBranches, branch: string): boolean {
 *   return merged.branches.includes(branch);
 * }
 * ```
 */
export declare class GitMergedBranches {
  /**
   * The remote branch the remote's HEAD names, such as `origin/main`, or the remote's HEAD itself, such as `origin/HEAD`, when it names no branch; `null` when
   * no remote has a HEAD.
   */
  public readonly base: string | null;

  /**
   * The local branches, without `refs/heads/`, whose tips the base holds, in git's order; none without a base; untrusted.
   */
  public readonly branches: readonly string[];

  /**
   * Creates the answer.
   * @param base The remote branch; a branch name, or `null` when no remote has a HEAD.
   * @param branches The local branches merged into it; each not empty, and none without a base.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the base isn't a branch name, a branch is empty, or there are branches without a base.
   * @example
   * ```ts
   * import { GitMergedBranches } from "@noldova/git.protocol";
   * export const merged: GitMergedBranches = new GitMergedBranches("origin/main", ["main", "fix/typo"]);
   * ```
   */
  public constructor(base: string | null, branches: readonly string[], reader?: JsonReader);

  /**
   * Reads the answer from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The answer's path in error messages; `$` by default.
   * @returns The answer.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field is out of its range.
   * @example
   * ```ts
   * import { GitMergedBranches } from "@noldova/git.protocol";
   * export const merged: GitMergedBranches = GitMergedBranches.fromJson({ base: "origin/main", branches: ["main"] });
   * ```
   */
  public static fromJson(value: unknown, path?: string): GitMergedBranches;

  /**
   * Writes the answer's JSON form, with the fields `base` and `branches`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { GitMergedBranches, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new GitMergedBranches(null, []).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The answer of `git.remoteTracks`: how far each remote branch is ahead of and behind HEAD, for the remote branches that aren't level with it, in git's
 * order, without each remote's `HEAD`.
 * @example
 * ```ts
 * import type { GitRemoteTracks } from "@noldova/git.protocol";
 * export function aheadOf(remote: GitRemoteTracks, branch: string): number {
 *   return remote.tracks.find(t => t.branch === branch)?.ahead ?? 0;
 * }
 * ```
 */
export declare class GitRemoteTracks {
  /**
   * Each remote branch, as `<remote>/<branch>`, with the commits it has that HEAD lacks and the commits HEAD has that it lacks; untrusted.
   */
  public readonly tracks: readonly GitBranchTrack[];

  /**
   * Creates the answer.
   * @param tracks The remote branches' tracks; each a remote branch's name, each once.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When a track's branch isn't a branch name or is named twice.
   * @example
   * ```ts
   * import { GitBranchTrack, GitRemoteTracks } from "@noldova/git.protocol";
   * export const remote: GitRemoteTracks = new GitRemoteTracks([new GitBranchTrack("origin/feature/x", 2, 1)]);
   * ```
   */
  public constructor(tracks: readonly GitBranchTrack[], reader?: JsonReader);

  /**
   * Reads the answer from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The answer's path in error messages; `$` by default.
   * @returns The answer.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a track is out of its range.
   * @example
   * ```ts
   * import { GitRemoteTracks } from "@noldova/git.protocol";
   * export const remote: GitRemoteTracks = GitRemoteTracks.fromJson({ tracks: [{ branch: "origin/main", ahead: 0, behind: 3 }] });
   * ```
   */
  public static fromJson(value: unknown, path?: string): GitRemoteTracks;

  /**
   * Writes the answer's JSON form, with the field `tracks`.
   * @returns The JSON object.
   * @example
   * ```ts
   * import { GitRemoteTracks, type JsonObject } from "@noldova/git.protocol";
   * export const json: JsonObject = new GitRemoteTracks([]).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The answer of `git.messageReferences`: the commits whose messages name references of the asked kind, in the order of `git.graph`, and whether
 * older commits went unread. It holds no message text.
 * @example
 * ```ts
 * import { GitMessageReferences } from "@noldova/git.protocol";
 * export const none: GitMessageReferences = new GitMessageReferences([], false);
 * ```
 */
export declare class GitMessageReferences {
  /**
   * The commits that name a reference, at most 5000; none before the first commit.
   */
  public readonly commits: readonly GitMessageReference[];

  /**
   * Whether the repository has commits past the ones read.
   */
  public readonly truncated: boolean;

  /**
   * Creates the answer, keeping its own copy of the commits.
   * @param commits The commits; at most 5000.
   * @param truncated Whether older commits went unread.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When it holds more than 5000 commits.
   */
  public constructor(commits: readonly GitMessageReference[], truncated: boolean, reader?: JsonReader);

  /**
   * Reads the answer from its JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The answer's path in error messages; `$` by default.
   * @returns The answer.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, too many commits, or a commit the protocol refuses.
   */
  public static fromJson(value: unknown, path?: string): GitMessageReferences;

  /**
   * Writes the answer's JSON form, with the fields `commits` and `truncated`.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of `git.messageReferences`: the folder whose repository to read, which references to find, and how many of the newest commits,
 * in the order of `git.graph`, to look in.
 * @example
 * ```ts
 * import { GitMessageReferenceKind, GitMessageReferencesParams } from "@noldova/git.protocol";
 * export const params: GitMessageReferencesParams = new GitMessageReferencesParams("/home/sample/repo", GitMessageReferenceKind.AzureBoards, 1000);
 * ```
 */
export declare class GitMessageReferencesParams {
  /**
   * The folder; absolute, at most 4096 characters, untrusted.
   */
  public readonly folder: string;

  /**
   * Which references to find.
   */
  public readonly kind: GitMessageReferenceKind;

  /**
   * How many of the newest commits to look in; 1 to 5000.
   */
  public readonly limit: number;

  /**
   * Creates the parameters.
   * @param folder The folder; absolute, at most 4096 characters.
   * @param kind Which references to find.
   * @param limit How many commits; 1 to 5000.
   * @param reader The reader the values came from, so an error names the field by its path; omitted for values that didn't come from JSON.
   * @throws {ProtocolFieldException} When the folder isn't absolute or the limit is outside 1 to 5000.
   */
  public constructor(folder: string, kind: GitMessageReferenceKind, limit: number, reader?: JsonReader);

  /**
   * Reads the parameters from their JSON form.
   * @param value The parsed JSON value, untrusted.
   * @param path The parameters' path in error messages; `$` by default.
   * @returns The parameters.
   * @throws {JsonException} When the value isn't an object, or a field is missing or of the wrong type; it comes from `@noldova/context.json`.
   * @throws {ProtocolFieldException} When the value holds an unknown field, or a field's value is invalid.
   */
  public static fromJson(value: unknown, path?: string): GitMessageReferencesParams;

  /**
   * Writes the parameters' JSON form, with the fields `folder`, `kind` and `limit`.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * `git.rebaseCheck`'s answer: one check per step, in the steps' order. Once a step would conflict, the steps after it are checked against that
 * step's own commit, as if the conflict were resolved by taking it whole.
 * @example
 * ```ts
 * import { GitRebaseCheck } from "@noldova/git.protocol";
 * export const check: GitRebaseCheck = new GitRebaseCheck([]);
 * ```
 */
export declare class GitRebaseCheck {
  /**
   * One check per step, in the steps' order.
   */
  public readonly steps: readonly GitRebaseStepCheck[];

  /**
   * @throws {ProtocolFieldException} When there are more than 500 steps.
   */
  public constructor(steps: readonly GitRebaseStepCheck[], reader?: JsonReader);

  /**
   * Reads the checks from JSON.
   * @throws {JsonException} When the JSON isn't the checks' shape.
   * @throws {ProtocolFieldException} When a field is out of range or unknown.
   */
  public static fromJson(value: unknown, path?: string): GitRebaseCheck;

  /**
   * Writes the checks as JSON.
   */
  public toJson(): JsonObject;
}

/**
 * The parameters of `git.rebase`: the folder, the full id of the commit to rebase the current branch onto, the steps in the order they run,
 * whether the other local branches on the replayed commits move with them, and the status it is based on.
 * @example
 * ```ts
 * import { GitRebaseParams, RebaseAction, RebaseStep } from "@noldova/git.protocol";
 * export const params: GitRebaseParams = new GitRebaseParams("/home/a/repo", "c".repeat(40), [new RebaseStep("a".repeat(40), RebaseAction.Pick, null)], true, "4f2a");
 * ```
 */
export declare class GitRebaseParams {
  /**
   * The repository's folder, absolute.
   */
  public readonly folder: string;

  /**
   * The full id of the commit to rebase onto.
   */
  public readonly onto: string;

  /**
   * The steps in the order they run.
   */
  public readonly steps: readonly RebaseStep[];

  /**
   * Whether the other local branches on the replayed commits move with them.
   */
  public readonly updateRefs: boolean;

  /**
   * The fingerprint of the status the rebase is based on.
   */
  public readonly basedOn: string;

  /**
   * @throws {ProtocolFieldException} When a field is out of range or the steps break {@link RebaseStep.requireSteps}.
   */
  public constructor(folder: string, onto: string, steps: readonly RebaseStep[], updateRefs: boolean, basedOn: string, reader?: JsonReader);

  /**
   * Reads the parameters from JSON.
   * @throws {JsonException} When the JSON isn't the parameters' shape.
   * @throws {ProtocolFieldException} When a field is out of range or unknown.
   */
  public static fromJson(value: unknown, path?: string): GitRebaseParams;

  /**
   * Writes the parameters as JSON.
   */
  public toJson(): JsonObject;
}
