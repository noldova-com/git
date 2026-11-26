/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import path from "node:path";

import { type IPermissionDetail, type IPermissionRequest, PermissionDetailKind, PermissionOption, ToolRisk } from "@noldova/desktop.runtime";
import { GitNames, type GitJournalEntry, type GitRefMove, type GitStatus, UndoMode, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { UndoBranchCheckedOutException } from "../exceptions/undo-branch-checked-out.exception.ts";
import { UndoDuringOperationException } from "../exceptions/undo-during-operation.exception.ts";
import { UndoMovedException } from "../exceptions/undo-moved.exception.ts";
import { UndoNotPossibleException } from "../exceptions/undo-not-possible.exception.ts";
import { UndoOtherWorktreeException } from "../exceptions/undo-other-worktree.exception.ts";
import { UndoUnknownException } from "../exceptions/undo-unknown.exception.ts";
import type { IGitWrite } from "../interfaces/i-git-write.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import type { RefSnapshot } from "../models/ref-snapshot.ts";
import type { RepositoryFolders } from "../models/repository-folders.ts";
import { WritePermission } from "../models/write-permission.ts";
import { Resources } from "../resources.ts";
import type { CheckpointStore } from "./checkpoint-store.ts";
import { FilePresence } from "./file-presence.ts";
import type { Journal } from "./journal.ts";
import type { ProgramRunner } from "./program-runner.ts";
import type { RefSnapshotReader } from "./ref-snapshot.reader.ts";
import { WorktreesReader } from "./worktrees.reader.ts";

/**
 * Undoes a write the journal recorded, only while everything it would put back is still where the write left it: the index's tree, or the
 * refs it moved, with the checked-out branch reset or switched back as the entry's mode says; a discard's paths are put back from the
 * checkpoint taken before it, and a stash is popped back.
 */
export class UndoWriter implements IGitWrite {
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.writeOutputBytes, Resources.longWriteMilliseconds);
  private static readonly READ_LIMITS: ProgramLimits = new ProgramLimits(Resources.lineOutputBytes, Resources.gitReadMilliseconds);
  private static readonly LIST_LIMITS: ProgramLimits = new ProgramLimits(Resources.listOutputBytes, Resources.gitReadMilliseconds);
  private static readonly OPTIONS: readonly PermissionOption[] = [PermissionOption.AllowOnce, PermissionOption.Deny];
  private readonly runner: ProgramRunner;
  private readonly snapshots: RefSnapshotReader;
  private readonly journal: Journal;
  private readonly checkpoints: CheckpointStore;
  private readonly worktrees: WorktreesReader;
  private readonly id: string;

  public readonly method: string = GitNames.undoMethod;
  public readonly undo: UndoMode = UndoMode.None;

  public constructor(runner: ProgramRunner, snapshots: RefSnapshotReader, journal: Journal, checkpoints: CheckpointStore, id: string) {
    this.runner = runner;
    this.snapshots = snapshots;
    this.journal = journal;
    this.checkpoints = checkpoints;
    this.worktrees = new WorktreesReader(runner);
    this.id = id;
  }

  public refuse(status: GitStatus): void {
    if (status.entries.some(t => t.conflict !== null) || status.operation !== null)
      throw new UndoDuringOperationException();
  }

  public async requestAsync(folders: RepositoryFolders, _status: GitStatus, _call: unknown): Promise<IPermissionRequest | null> {
    const entry = this.entryOf(folders);
    return WritePermission.create(
      GitNames.undoMethod,
      folders.top,
      Resources.formatUndoTitle(entry.method),
      UndoWriter.detailsOf(entry),
      ToolRisk.High,
      UndoWriter.OPTIONS);
  }

  public async runAsync(folders: RepositoryFolders, status: GitStatus, signal?: AbortSignal): Promise<void> {
    const entry = this.entryOf(folders);
    const now = await this.snapshots.readAsync(folders, entry.undo === UndoMode.Index, signal);
    if (!UndoWriter.isUnmoved(entry, now))
      throw new UndoMovedException();
    if (entry.undo === UndoMode.Stash) {
      await this.popAsync(folders, status, String(entry.checkpoint), signal);
      this.journal.remove(folders.commonGitFolder, entry.id);
      return;
    }
    const rename = UndoWriter.renameBackOf(entry);
    const head = UndoWriter.headMoveOf(entry);
    const rest = rename !== null ? []
      : entry.undo === UndoMode.Mixed || entry.undo === UndoMode.Keep ? entry.moves.filter(t => t !== head)
      : entry.undo === UndoMode.Switch ? entry.moves.filter(t => t.name !== Resources.headRevision)
      : entry.moves;
    await this.refuseCheckedOutAsync(folders, rest, signal);
    if (entry.undo === UndoMode.Index)
      await this.runGitAsync(folders, [...Resources.readTreeArguments, String(entry.indexBefore)], signal);
    if (entry.undo === UndoMode.Checkpoint)
      await this.checkpoints.restoreAsync(folders.top, String(entry.checkpoint), entry.paths, signal);
    if (rename !== null)
      await this.runGitAsync(folders, rename, signal);
    else if (entry.undo === UndoMode.Mixed || entry.undo === UndoMode.Keep)
      await this.runGitAsync(folders, [...Resources.resetArguments, Resources.resetOptionOf(entry.undo), UndoWriter.resetTargetOf(head)], signal);
    else if (entry.undo === UndoMode.Switch)
      await this.runGitAsync(folders, UndoWriter.switchBackOf(entry, now), signal);
    if (rest.length > 0)
      await this.runGitAsync(folders, Resources.updateRefsArguments, signal, rest.map(t => UndoWriter.commandOf(t)).join(""));
    this.journal.remove(folders.commonGitFolder, entry.id);
  }

  /**
   * Refuses to delete or move a branch that another worktree has checked out, as `update-ref` doesn't look at other worktrees the way `git branch` does:
   * it would leave that worktree on a branch that is gone, or on another commit under its files.
   */
  private async refuseCheckedOutAsync(folders: RepositoryFolders, moves: readonly GitRefMove[], signal?: AbortSignal): Promise<void> {
    const branches = moves.filter(t => t.name.startsWith(Resources.branchRefsPrefix)).map(t => t.name.slice(Resources.branchRefsPrefix.length));
    if (branches.length === 0)
      return;
    const here = path.resolve(folders.top);
    for (const worktree of (await this.worktrees.readAsync(folders.top, signal)).worktrees)
      if (worktree.branch !== null && branches.includes(worktree.branch) && path.relative(path.resolve(worktree.path), here) !== "")
        throw new UndoBranchCheckedOutException(worktree.branch, worktree.path);
  }

  /**
   * Pops the stash back with its index, only while it is still the newest stash, HEAD is still the commit it was made on, the folder has no
   * changes and nothing, an ignored file included, is at a path of the untracked files it holds, so it applies cleanly or not at all; otherwise
   * the stash stays and nothing changes.
   */
  private async popAsync(folders: RepositoryFolders, status: GitStatus, id: string, signal?: AbortSignal): Promise<void> {
    const values = Resources.formatStashCheckArguments(id);
    const read = await this.runner.runAsync(ProgramRun.readGit(new GitArguments(values), folders.top, UndoWriter.READ_LIMITS, signal));
    const [stash, head, base] = read.output.toString(Resources.utf8Encoding).split(Resources.lineEnd);
    if (read.exit.code !== 0 || stash !== id || head !== base || status.entries.length > 0 || await this.isUntrackedInTheWayAsync(folders, id, signal))
      throw new UndoMovedException();
    await this.runGitAsync(folders, Resources.stashPopArguments, signal);
  }

  /**
   * Whether anything is at a path of the untracked files the stash holds in its third parent, which status leaves out when it is ignored and which
   * `git stash pop` refuses to overwrite only after it applied the tracked changes; a stash without untracked files has no third parent to list,
   * and a listing that fails or is cut short counts as in the way, so the undo refuses rather than leaving a name unchecked.
   */
  private async isUntrackedInTheWayAsync(folders: RepositoryFolders, id: string, signal?: AbortSignal): Promise<boolean> {
    const parent = new GitArguments(Resources.formatStashUntrackedParentArguments(id));
    if ((await this.runner.runAsync(ProgramRun.readGit(parent, folders.top, UndoWriter.READ_LIMITS, signal))).exit.code !== 0)
      return false;
    const values = Resources.formatStashUntrackedArguments(id);
    const tree = await this.runner.runAsync(ProgramRun.readGit(new GitArguments(values), folders.top, UndoWriter.LIST_LIMITS, signal));
    if (tree.isTruncated || tree.exit.code !== 0)
      return true;
    const top: string = path.resolve(folders.top);
    for (const name of tree.output.toString(Resources.utf8Encoding).split(Resources.nulCharacter).filter(t => t.length > 0))
      if (await UndoWriter.isTakenAsync(top, path.join(top, name)))
        return true;
    return false;
  }

  /**
   * Whether anything is at the file or in the way of it: from the file up, the first entry there decides, the file itself or anything but a folder
   * taking it, a link whose target is gone included, as git's checkout sees it, and a folder leaving it free. Some systems answer a path through a
   * file as missing rather than as no folder, so each level is looked at.
   */
  private static async isTakenAsync(top: string, file: string): Promise<boolean> {
    for (let at = file; at.length > top.length; at = path.dirname(at)) {
      const entry = await FilePresence.entryAsync(at);
      if (entry !== null)
        return at === file || !entry.isDirectory();
    }
    return false;
  }

  /** What an agent's undo puts back: the refs it moves, a discard's paths, or the stash it pops. */
  private static detailsOf(entry: GitJournalEntry): readonly IPermissionDetail[] {
    if (entry.undo === UndoMode.Stash)
      return [{ label: Resources.stashLabel, kind: PermissionDetailKind.Code, value: String(entry.checkpoint) }];
    return entry.undo === UndoMode.Checkpoint
      ? [{ label: Resources.pathsLabel, kind: PermissionDetailKind.Code, value: entry.paths.join(Resources.lineEnd) }]
      : [{ label: Resources.refsLabel, kind: PermissionDetailKind.Code, value: entry.moves.map(t => UndoWriter.lineOf(t)).join(Resources.lineEnd) },
        ...entry.method === GitNames.deleteBranchMethod ? [{ label: Resources.noteLabel, kind: PermissionDetailKind.Text, value: Resources.deletedBranchSettingsNote }] : []];
  }

  private entryOf(folders: RepositoryFolders): GitJournalEntry {
    const entry = this.journal.find(folders.commonGitFolder, this.id);
    if (entry === null)
      throw new UndoUnknownException();
    if (entry.undo === UndoMode.None)
      throw new UndoNotPossibleException();
    if (UndoWriter.isOfWorktree(entry) && this.journal.worktreeOf(entry.id) !== folders.gitFolder)
      throw new UndoOtherWorktreeException();
    return entry;
  }

  /**
   * Whether undoing the entry acts on its worktree's own HEAD, index, files or stash, rather than on refs alone: the worktrees of one repository share the
   * journal, and two detached at the same commit look alike to the check of what moved.
   */
  private static isOfWorktree(entry: GitJournalEntry): boolean {
    return entry.undo !== UndoMode.Refs || entry.moves.some(t => t.name === Resources.headRevision);
  }

  private async runGitAsync(folders: RepositoryFolders, values: readonly string[], signal?: AbortSignal, input: string = ""): Promise<void> {
    const gitArguments = new GitArguments(values);
    const run = ProgramRun.writeGit(gitArguments, folders.top, folders.gitFolder, folders.commonGitFolder, UndoWriter.LIMITS, signal);
    const result = await this.runner.runAsync(run.withInput(Buffer.from(input, Resources.utf8Encoding)));
    if (result.exit.code !== 0)
      throw new GitFailedException(Resources.formatGitCommand(values), { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
  }

  /** Whether the branch, the refs and the index are still where the write left them. */
  private static isUnmoved(entry: GitJournalEntry, now: RefSnapshot): boolean {
    return now.branch === entry.branchAfter
      && entry.moves.every(t => now.valueOf(t.name) === t.after)
      && (entry.undo !== UndoMode.Index || now.index === entry.indexAfter);
  }

  /** The move of the commit a reset moved: HEAD itself when detached, or the checked-out branch's ref. */
  private static headMoveOf(entry: GitJournalEntry): GitRefMove | null {
    const name = entry.branchAfter === null ? Resources.headRevision : Resources.formatBranchRef(entry.branchAfter);
    return entry.moves.find(t => t.name === name) ?? null;
  }

  /** The commit a reset back moves the branch to; a branch that didn't exist before the write has none, so it isn't undone. */
  private static resetTargetOf(head: GitRefMove | null): string {
    if (head === null || head.before === null)
      throw new UndoNotPossibleException();
    return head.before;
  }

  /** Back to the branch the write left, or to the commit HEAD was detached at, which is where it still is when the write didn't move it. */
  private static switchBackOf(entry: GitJournalEntry, now: RefSnapshot): readonly string[] {
    if (entry.branch !== null)
      return [...Resources.switchBackArguments, Resources.endOfOptions, entry.branch];
    const detached = entry.moves.find(t => t.name === Resources.headRevision)?.before ?? now.head;
    if (detached === null)
      throw new UndoNotPossibleException();
    return [...Resources.switchBackArguments, Resources.detachOption, Resources.endOfOptions, detached];
  }

  /**
   * A branch rename is undone by renaming the branch back, so HEAD follows it when it is checked out and its `branch.<name>.*` settings come
   * back with it, which putting the refs back would lose.
   */
  private static renameBackOf(entry: GitJournalEntry): readonly string[] | null {
    if (entry.method !== GitNames.renameBranchMethod)
      return null;
    const from = entry.moves.find(t => t.before === null && t.name.startsWith(Resources.branchRefsPrefix));
    const to = entry.moves.find(t => t.after === null && t.name.startsWith(Resources.branchRefsPrefix));
    if (from === undefined || to === undefined)
      return null;
    return [...Resources.renameBranchArguments, from.name.slice(Resources.branchRefsPrefix.length), to.name.slice(Resources.branchRefsPrefix.length)];
  }

  /** One `update-ref --stdin` command that puts a ref back, checking it still names what the write left. */
  private static commandOf(move: GitRefMove): string {
    if (move.before === null)
      return Resources.formatDeleteRefCommand(move.name, String(move.after));
    if (move.after === null)
      return Resources.formatCreateRefCommand(move.name, move.before);
    return Resources.formatUpdateRefCommand(move.name, move.before, move.after);
  }

  private static lineOf(move: GitRefMove): string {
    return Resources.formatRefMoveLine(move.name, move.after, move.before);
  }
}
