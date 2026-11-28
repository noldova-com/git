/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import path from "node:path";

import "@noldova/context.core";
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
    if (status.entries.some(t => !Object.isNull(t.conflict)) || !Object.isNull(status.operation))
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
    const rest = !Object.isNull(rename) ? []
      : entry.undo === UndoMode.Mixed || entry.undo === UndoMode.Keep ? entry.moves.filter(t => t !== head)
      : entry.undo === UndoMode.Switch ? entry.moves.filter(t => t.name !== Resources.headRevision)
      : entry.moves;
    await this.refuseCheckedOutAsync(folders, rest, signal);
    if (entry.undo === UndoMode.Index)
      await this.runGitAsync(folders, [...Resources.readTreeArguments, String(entry.indexBefore)], signal);
    if (entry.undo === UndoMode.Checkpoint)
      await this.checkpoints.restoreAsync(folders.top, String(entry.checkpoint), entry.paths, signal);
    if (!Object.isNull(rename))
      await this.runGitAsync(folders, rename, signal);
    else if (entry.undo === UndoMode.Mixed || entry.undo === UndoMode.Keep)
      await this.runGitAsync(folders, [...Resources.resetArguments, Resources.resetOptionOf(entry.undo), UndoWriter.resetTargetOf(head)], signal);
    else if (entry.undo === UndoMode.Switch)
      await this.runGitAsync(folders, UndoWriter.switchBackOf(entry, now), signal);
    if (rest.length > 0)
      await this.runGitAsync(folders, Resources.updateRefsArguments, signal, rest.map(t => UndoWriter.commandOf(t)).join(""));
    this.journal.remove(folders.commonGitFolder, entry.id);
  }

  private async refuseCheckedOutAsync(folders: RepositoryFolders, moves: readonly GitRefMove[], signal?: AbortSignal): Promise<void> {
    const branches = moves.filter(t => t.name.startsWith(Resources.branchRefsPrefix)).map(t => t.name.slice(Resources.branchRefsPrefix.length));
    if (branches.length === 0)
      return;
    const here = path.resolve(folders.top);
    for (const worktree of (await this.worktrees.readAsync(folders.top, signal)).worktrees)
      if (!Object.isNull(worktree.branch) && branches.includes(worktree.branch) && path.relative(path.resolve(worktree.path), here) !== "")
        throw new UndoBranchCheckedOutException(worktree.branch, worktree.path);
  }

  private async popAsync(folders: RepositoryFolders, status: GitStatus, id: string, signal?: AbortSignal): Promise<void> {
    const values = Resources.formatStashCheckArguments(id);
    const read = await this.runner.runAsync(ProgramRun.readGit(new GitArguments(values), folders.top, UndoWriter.READ_LIMITS, signal));
    const [stash, head, base] = read.output.toString(Resources.utf8Encoding).split(Resources.lineEnd);
    if (read.exit.code !== 0 || stash !== id || head !== base || status.entries.length > 0 || await this.isUntrackedInTheWayAsync(folders, id, signal))
      throw new UndoMovedException();
    await this.runGitAsync(folders, Resources.stashPopArguments, signal);
  }

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

  private static async isTakenAsync(top: string, file: string): Promise<boolean> {
    for (let at = file; at.length > top.length; at = path.dirname(at)) {
      const entry = await FilePresence.entryAsync(at);
      if (!Object.isNull(entry))
        return at === file || !entry.isDirectory();
    }
    return false;
  }

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
    if (Object.isNull(entry))
      throw new UndoUnknownException();
    if (entry.undo === UndoMode.None)
      throw new UndoNotPossibleException();
    if (UndoWriter.isOfWorktree(entry) && this.journal.worktreeOf(entry.id) !== folders.gitFolder)
      throw new UndoOtherWorktreeException();
    return entry;
  }

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

  private static isUnmoved(entry: GitJournalEntry, now: RefSnapshot): boolean {
    return now.branch === entry.branchAfter
      && entry.moves.every(t => now.valueOf(t.name) === t.after)
      && (entry.undo !== UndoMode.Index || now.index === entry.indexAfter);
  }

  private static headMoveOf(entry: GitJournalEntry): GitRefMove | null {
    const name = Object.isNull(entry.branchAfter) ? Resources.headRevision : Resources.formatBranchRef(entry.branchAfter);
    return entry.moves.find(t => t.name === name) ?? null;
  }

  private static resetTargetOf(head: GitRefMove | null): string {
    if (Object.isNull(head) || Object.isNull(head.before))
      throw new UndoNotPossibleException();
    return head.before;
  }

  private static switchBackOf(entry: GitJournalEntry, now: RefSnapshot): readonly string[] {
    if (!Object.isNull(entry.branch))
      return [...Resources.switchBackArguments, Resources.endOfOptions, entry.branch];
    const detached = entry.moves.find(t => t.name === Resources.headRevision)?.before ?? now.head;
    if (Object.isNull(detached))
      throw new UndoNotPossibleException();
    return [...Resources.switchBackArguments, Resources.detachOption, Resources.endOfOptions, detached];
  }

  private static renameBackOf(entry: GitJournalEntry): readonly string[] | null {
    if (entry.method !== GitNames.renameBranchMethod)
      return null;
    const from = entry.moves.find(t => Object.isNull(t.before) && t.name.startsWith(Resources.branchRefsPrefix));
    const to = entry.moves.find(t => Object.isNull(t.after) && t.name.startsWith(Resources.branchRefsPrefix));
    if (Object.isUndefined(from) || Object.isUndefined(to))
      return null;
    return [...Resources.renameBranchArguments, from.name.slice(Resources.branchRefsPrefix.length), to.name.slice(Resources.branchRefsPrefix.length)];
  }

  private static commandOf(move: GitRefMove): string {
    if (Object.isNull(move.before))
      return Resources.formatDeleteRefCommand(move.name, String(move.after));
    if (Object.isNull(move.after))
      return Resources.formatCreateRefCommand(move.name, move.before);
    return Resources.formatUpdateRefCommand(move.name, move.before, move.after);
  }

  private static lineOf(move: GitRefMove): string {
    return Resources.formatRefMoveLine(move.name, move.after, move.before);
  }
}
