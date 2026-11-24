/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IPermissionRequest, PermissionDetailKind, PermissionOption, ToolRisk } from "@noldova/desktop.runtime";
import { GitNames, type GitStatus, UndoMode, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { PickDuringOperationException } from "../exceptions/pick-during-operation.exception.ts";
import { PickEmptyException } from "../exceptions/pick-empty.exception.ts";
import { PickStoppedException } from "../exceptions/pick-stopped.exception.ts";
import type { IGitWrite } from "../interfaces/i-git-write.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import type { RepositoryFolders } from "../models/repository-folders.ts";
import { WritePermission } from "../models/write-permission.ts";
import { Resources } from "../resources.ts";
import type { HooksReader } from "./hooks.reader.ts";
import { LogReader } from "./log.reader.ts";
import type { ProgramRunner } from "./program-runner.ts";

/**
 * Cherry-picks a commit onto the current branch, or reverts it there, as a new commit, taking a merge against its first parent, as its detail shows it;
 * or merges the commit into the current branch, fast-forwarding where it can.
 */
export class PickWriter implements IGitWrite {
  public readonly undo: UndoMode = UndoMode.Keep;
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.writeOutputBytes, Resources.longWriteMilliseconds);
  private static readonly READ_LIMITS: ProgramLimits = new ProgramLimits(Resources.lineOutputBytes, Resources.gitReadMilliseconds);
  private static readonly OPTIONS: readonly PermissionOption[] = [PermissionOption.AllowOnce, PermissionOption.Deny];
  private readonly runner: ProgramRunner;
  private readonly hooks: HooksReader;
  public readonly method: string;
  private readonly id: string;

  public constructor(runner: ProgramRunner, hooks: HooksReader, method: string, id: string) {
    this.runner = runner;
    this.hooks = hooks;
    this.method = method;
    this.id = id;
  }

  private get command(): string {
    if (this.isMerge)
      return Resources.mergeCommand;
    return this.isRevert ? Resources.revertCommand : Resources.cherryPickCommand;
  }

  private get isRevert(): boolean {
    return this.method === GitNames.revertMethod;
  }

  private get isMerge(): boolean {
    return this.method === GitNames.mergeMethod;
  }

  private formatTitle(shortId: string, branch: string | null): string {
    if (this.isMerge)
      return Resources.formatMergeTitle(shortId, branch);
    return this.isRevert ? Resources.formatRevertTitle(shortId, branch) : Resources.formatCherryPickTitle(shortId, branch);
  }

  public refuse(status: GitStatus): void {
    if (status.entries.some(t => t.conflict !== null) || status.operation !== null)
      throw new PickDuringOperationException();
  }

  public async requestAsync(folders: RepositoryFolders, status: GitStatus, _call: unknown, signal?: AbortSignal): Promise<IPermissionRequest | null> {
    const commit = await this.readAsync(folders.top, signal);
    const hooks = await this.hooks.readAsync(folders.top, this.isMerge ? Resources.mergeHooks : Resources.commitHooks, signal);
    const shortId = this.id.slice(0, Resources.shortIdLength);
    return WritePermission.create(
      this.method,
      folders.top,
      this.formatTitle(shortId, status.branch),
      [{ label: Resources.commitSubjectLabel, kind: PermissionDetailKind.Text, value: commit.subject }, WritePermission.hooksDetail(hooks)],
      ToolRisk.Medium,
      PickWriter.OPTIONS);
  }

  public async runAsync(folders: RepositoryFolders, _status: GitStatus, signal?: AbortSignal): Promise<void> {
    const gitArguments = new GitArguments([...await this.argumentsAsync(folders.top, signal), this.id]).withSettings(Resources.rerereSettings);
    const result = await this.runner.runAsync(ProgramRun.writeGit(gitArguments, folders.top, folders.gitFolder, folders.commonGitFolder, PickWriter.LIMITS, signal));
    if (result.exit.code === 0)
      return;
    const text = `${result.output.toString(Resources.utf8Encoding)}${result.errors.toString(Resources.utf8Encoding)}`;
    const output = { text, source: UntrustedSource.Repository };
    if (Resources.pickConflictPattern.test(text))
      throw new PickStoppedException(output);
    const abort = new GitArguments([this.command, Resources.abortOption]);
    await this.runner.runAsync(ProgramRun.writeGit(abort, folders.top, folders.gitFolder, folders.commonGitFolder, PickWriter.LIMITS, signal));
    if (Resources.pickEmptyPattern.test(text))
      throw new PickEmptyException(output);
    throw new GitFailedException(this.command, output);
  }

  private async argumentsAsync(top: string, signal?: AbortSignal): Promise<readonly string[]> {
    if (this.isMerge)
      return Resources.mergeArguments;
    const commit = await this.readAsync(top, signal);
    const command = this.isRevert ? Resources.revertArguments : Resources.cherryPickArguments;
    return [...command, ...commit.isMerge ? Resources.mainlineArguments : []];
  }

  private async readAsync(top: string, signal?: AbortSignal): Promise<{ readonly isMerge: boolean; readonly subject: string }> {
    const gitArguments = new GitArguments([...Resources.pickCommitArguments, Resources.endOfOptions, this.id]);
    const result = await this.runner.runAsync(ProgramRun.readGit(gitArguments, top, PickWriter.READ_LIMITS, signal));
    if (result.exit.code !== 0)
      throw new GitFailedException(Resources.logCommand, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
    const [parents = "", subject = ""] = result.output.toString(Resources.utf8Encoding).split(Resources.nulCharacter);
    return { isMerge: parents.trim().split(Resources.space).length > 1, subject: LogReader.toLine(subject.trimEnd()) };
  }
}
