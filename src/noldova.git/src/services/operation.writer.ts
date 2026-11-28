/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IPermissionDetail, type IPermissionRequest, PermissionDetailKind, PermissionOption, ToolRisk } from "@noldova/desktop.runtime";
import { GitNames, type GitStatus, OperationKind, UndoMode, UntrustedSource } from "@noldova/git.protocol";

import { CommitConflictsException } from "../exceptions/commit-conflicts.exception.ts";
import { ContinueMarkersLeftException } from "../exceptions/continue-markers-left.exception.ts";
import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { NoOperationException } from "../exceptions/no-operation.exception.ts";
import { SkipMergeException } from "../exceptions/skip-merge.exception.ts";
import type { IGitWrite } from "../interfaces/i-git-write.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import type { RepositoryFolders } from "../models/repository-folders.ts";
import { WritePermission } from "../models/write-permission.ts";
import { Resources } from "../resources.ts";
import type { HooksReader } from "./hooks.reader.ts";
import { MarkerCheckReader } from "./marker-check.reader.ts";
import type { ProgramRunner } from "./program-runner.ts";

export class OperationWriter implements IGitWrite {
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.writeOutputBytes, Resources.longWriteMilliseconds);
  private static readonly OPTIONS: readonly PermissionOption[] = [PermissionOption.AllowOnce, PermissionOption.Deny];

  private readonly runner: ProgramRunner;
  private readonly hooks: HooksReader;
  public readonly method: string;
  public readonly undo: UndoMode = UndoMode.None;

  public constructor(runner: ProgramRunner, hooks: HooksReader, method: string) {
    this.runner = runner;
    this.hooks = hooks;
    this.method = method;
  }

  private get isContinue(): boolean {
    return this.method === GitNames.continueOperationMethod;
  }

  private get isAbort(): boolean {
    return !this.isContinue && !this.isSkip;
  }

  private get isSkip(): boolean {
    return this.method === GitNames.skipOperationMethod;
  }

  private get option(): string {
    return this.isContinue ? Resources.continueOption : this.isSkip ? Resources.skipOption : Resources.abortOption;
  }

  public refuse(status: GitStatus): void {
    if (status.operation === null)
      throw new NoOperationException();
    if (this.isContinue && status.entries.some(t => t.conflict !== null))
      throw new CommitConflictsException();
    if (this.isSkip && status.operation.kind === OperationKind.Merge)
      throw new SkipMergeException();
  }

  public async requestAsync(folders: RepositoryFolders, status: GitStatus, _call: unknown, signal?: AbortSignal): Promise<IPermissionRequest | null> {
    const name = OperationWriter.commandOf(OperationWriter.kindOf(status));
    const hooks: IPermissionDetail[] = this.isContinue || this.isSkip
      ? [WritePermission.hooksDetail(await this.hooks.readAsync(folders.top, Resources.continueHooks, signal))]
      : [];
    const notes: IPermissionDetail[] = this.isContinue ? [] : [{ label: Resources.noteLabel, kind: PermissionDetailKind.Text, value: this.isSkip ? Resources.skipNote : Resources.abortNote }];
    return WritePermission.create(
      this.method,
      folders.top,
      this.isContinue ? Resources.formatContinueTitle(name) : this.isSkip ? Resources.formatSkipTitle(name) : Resources.formatAbortTitle(name),
      [...hooks, ...notes],
      ToolRisk.High,
      OperationWriter.OPTIONS);
  }

  public async runAsync(folders: RepositoryFolders, status: GitStatus, signal?: AbortSignal): Promise<void> {
    const command = OperationWriter.commandOf(OperationWriter.kindOf(status));
    if (this.isContinue)
      await this.checkMarkersAsync(folders.top, signal);
    const gitArguments = new GitArguments([command, this.option])
      .withSettings([...Resources.acceptEditorSettings, ...Resources.rerereSettings]);
    const result = await this.runner.runAsync(ProgramRun.writeGit(gitArguments, folders.top, folders.gitFolder, folders.commonGitFolder, OperationWriter.LIMITS, signal));
    if (result.exit.code === 0)
      return;
    const text = `${result.output.toString(Resources.utf8Encoding)}${result.errors.toString(Resources.utf8Encoding)}`;
    if (!this.isAbort && Resources.pickConflictPattern.test(text))
      return;
    throw new GitFailedException(command, { text, source: UntrustedSource.Repository });
  }

  private async checkMarkersAsync(top: string, signal?: AbortSignal): Promise<void> {
    const lines = await new MarkerCheckReader(this.runner).readLinesAsync(top, signal);
    if (lines.length > 0)
      throw new ContinueMarkersLeftException({ text: lines.join(Resources.lineEnd), source: UntrustedSource.Repository });
  }

  private static kindOf(status: GitStatus): OperationKind {
    if (status.operation === null)
      throw new NoOperationException();
    return status.operation.kind;
  }

  private static commandOf(kind: OperationKind): string {
    return Resources.operationCommands[kind];
  }
}
