/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import "@noldova/context.core";
import { type IPermissionRequest, PermissionDetailKind, PermissionOption, ToolRisk } from "@noldova/desktop.runtime";
import { GitNames, type GitStatus, ResetMode, UndoMode, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { ResetDuringOperationException } from "../exceptions/reset-during-operation.exception.ts";
import { ResetNoCommitException } from "../exceptions/reset-no-commit.exception.ts";
import { UndoCommitPushedException } from "../exceptions/undo-commit-pushed.exception.ts";
import { UndoCommitRootException } from "../exceptions/undo-commit-root.exception.ts";
import type { IGitWrite } from "../interfaces/i-git-write.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import type { RepositoryFolders } from "../models/repository-folders.ts";
import { WritePermission } from "../models/write-permission.ts";
import { Resources } from "../resources.ts";
import { LogReader } from "./log.reader.ts";
import type { ProgramRunner } from "./program-runner.ts";

export class ResetWriter implements IGitWrite {
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.writeOutputBytes, Resources.longWriteMilliseconds);
  private static readonly READ_LIMITS: ProgramLimits = new ProgramLimits(Resources.lineOutputBytes, Resources.gitReadMilliseconds);
  private static readonly OPTIONS: readonly PermissionOption[] = [PermissionOption.AllowOnce, PermissionOption.Deny];
  private static readonly UNDO: Readonly<Record<ResetMode, UndoMode>> = { [ResetMode.Soft]: UndoMode.Refs, [ResetMode.Mixed]: UndoMode.Mixed, [ResetMode.Keep]: UndoMode.Keep };
  private readonly runner: ProgramRunner;
  private readonly mode: ResetMode;
  private readonly id: string | null;

  public readonly method: string;
  public readonly undo: UndoMode;

  public constructor(runner: ProgramRunner, mode: ResetMode, id: string | null) {
    this.runner = runner;
    this.mode = Object.isNull(id) ? ResetMode.Soft : mode;
    this.id = id;
    this.method = Object.isNull(id) ? GitNames.undoCommitMethod : GitNames.resetMethod;
    this.undo = ResetWriter.UNDO[this.mode];
  }

  public refuse(status: GitStatus): void {
    if (status.entries.some(t => !Object.isNull(t.conflict)) || !Object.isNull(status.operation))
      throw new ResetDuringOperationException();
    if (Object.isNull(status.head))
      throw new ResetNoCommitException();
    if (Object.isNull(this.id) && !Object.isNull(status.upstream) && !status.upstream.gone && status.upstream.ahead === 0)
      throw new UndoCommitPushedException();
  }

  public async requestAsync(folders: RepositoryFolders, status: GitStatus, _call: unknown, signal?: AbortSignal): Promise<IPermissionRequest | null> {
    const target = await this.targetAsync(folders.top, signal);
    const subject = await this.readAsync(new GitArguments([...Resources.subjectArguments, Resources.endOfOptions, target]), folders.top, signal);
    const shortId = target.slice(0, Resources.shortIdLength);
    return WritePermission.create(
      this.method,
      folders.top,
      Object.isNull(this.id) ? Resources.formatUndoCommitTitle(status.branch) : Resources.formatResetTitle(status.branch, shortId, this.mode),
      [{ label: Resources.commitSubjectLabel, kind: PermissionDetailKind.Text, value: Resources.formatCommitLine(shortId, LogReader.toLine(subject)) }],
      ToolRisk.High,
      ResetWriter.OPTIONS);
  }

  public async runAsync(folders: RepositoryFolders, _status: GitStatus, signal?: AbortSignal): Promise<void> {
    const target = await this.targetAsync(folders.top, signal);
    const gitArguments = new GitArguments([...Resources.resetArguments, Resources.resetOptionOf(this.undo), target]);
    const result = await this.runner.runAsync(ProgramRun.writeGit(gitArguments, folders.top, folders.gitFolder, folders.commonGitFolder, ResetWriter.LIMITS, signal));
    if (result.exit.code !== 0)
      throw new GitFailedException(Resources.resetCommand, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
  }

  private async targetAsync(top: string, signal?: AbortSignal): Promise<string> {
    if (!Object.isNull(this.id))
      return this.id;
    const gitArguments = new GitArguments(Resources.parentArguments);
    const result = await this.runner.runAsync(ProgramRun.readGit(gitArguments, top, ResetWriter.READ_LIMITS, signal));
    if (result.exit.code !== 0)
      throw new UndoCommitRootException();
    return result.output.toString(Resources.utf8Encoding).replace(Resources.lineEndPattern, "");
  }

  private async readAsync(gitArguments: GitArguments, top: string, signal?: AbortSignal): Promise<string> {
    const result = await this.runner.runAsync(ProgramRun.readGit(gitArguments, top, ResetWriter.READ_LIMITS, signal));
    if (result.exit.code !== 0)
      throw new GitFailedException(Resources.logCommand, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
    return result.output.toString(Resources.utf8Encoding).replace(Resources.lineEndPattern, "");
  }
}
