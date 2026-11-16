/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { type IPermissionRequest, PermissionDetailKind, PermissionOption, ToolRisk } from "@noldova/desktop.runtime";
import { FileState, GitNames, type GitStatus, type StatusEntry, UntrustedSource } from "@noldova/git.protocol";

import { CommitConflictsException } from "../exceptions/commit-conflicts.exception.ts";
import { CommitHookFailedException } from "../exceptions/commit-hook-failed.exception.ts";
import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { NothingStagedException } from "../exceptions/nothing-staged.exception.ts";
import { RequestTooLargeException } from "../exceptions/request-too-large.exception.ts";
import type { IGitWrite } from "../interfaces/i-git-write.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import type { ProgramResult } from "../models/program-result.ts";
import { ProgramRun } from "../models/program-run.ts";
import type { RepositoryFolders } from "../models/repository-folders.ts";
import { WritePermission } from "../models/write-permission.ts";
import { Resources } from "../resources.ts";
import type { HooksReader } from "./hooks.reader.ts";
import { LogReader } from "./log.reader.ts";
import type { ProgramRunner } from "./program-runner.ts";

export class CommitWriter implements IGitWrite {
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.writeOutputBytes, Resources.longWriteMilliseconds);
  private static readonly IDENT_LIMITS: ProgramLimits = new ProgramLimits(Resources.lineOutputBytes, Resources.gitReadMilliseconds);
  private static readonly IDENT: GitArguments = new GitArguments(Resources.identArguments);
  private static readonly OPTIONS: readonly PermissionOption[] = [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny];
  private static readonly UNSTAGED: readonly FileState[] = [FileState.Unmodified, FileState.Untracked, FileState.Ignored];
  private readonly runner: ProgramRunner;
  private readonly hooks: HooksReader;
  private readonly message: string;

  public constructor(runner: ProgramRunner, hooks: HooksReader, message: string) {
    this.runner = runner;
    this.hooks = hooks;
    this.message = message;
  }

  public refuse(status: GitStatus): void {
    if (status.entries.some(t => t.conflict !== null))
      throw new CommitConflictsException();
    if (!status.entries.some(CommitWriter.isStaged))
      throw new NothingStagedException();
  }

  public async requestAsync(folders: RepositoryFolders, status: GitStatus, _call: unknown, signal?: AbortSignal): Promise<IPermissionRequest | null> {
    if (status.truncated)
      throw new RequestTooLargeException();
    const ident = await this.runner.runAsync(ProgramRun.readGit(CommitWriter.IDENT, folders.top, CommitWriter.IDENT_LIMITS, signal));
    if (ident.exit.code !== 0)
      throw new GitFailedException(Resources.formatGitCommand(CommitWriter.IDENT.values), { text: ident.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
    const hooks = await this.hooks.readAsync(folders.top, Resources.commitHooks, signal);
    const staged = status.entries.filter(CommitWriter.isStaged);
    return WritePermission.create(
      GitNames.commitMethod,
      folders.top,
      Resources.formatCommitTitle(staged.length, status.branch),
      [
        { label: Resources.messageLabel, kind: PermissionDetailKind.AgentText, value: this.message },
        { label: Resources.filesLabel, kind: PermissionDetailKind.Code, value: staged.map(CommitWriter.lineOf).join(Resources.lineEnd) },
        { label: Resources.authorLabel, kind: PermissionDetailKind.Text, value: Resources.formatAuthor(LogReader.toLine(ident.output.toString(Resources.utf8Encoding).replace(Resources.identTimePattern, ""))) },
        WritePermission.hooksDetail(hooks)
      ],
      ToolRisk.Medium,
      CommitWriter.OPTIONS);
  }

  public async runAsync(folders: RepositoryFolders, _status: GitStatus, signal?: AbortSignal): Promise<void> {
    const gitArguments = new GitArguments([...Resources.commitArguments, Resources.formatMessageOption(this.message)]);
    const result = await this.runner.runAsync(ProgramRun.writeGit(gitArguments, folders.top, folders.gitFolder, folders.commonGitFolder, CommitWriter.LIMITS, signal));
    if (result.exit.code === 0)
      return;
    const output = { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository };
    const refusing = await this.hooks.readAsync(folders.top, Resources.refusingCommitHooks, signal);
    if (refusing !== null && refusing.length > 0 && CommitWriter.isHookRefusal(result, output.text))
      throw new CommitHookFailedException(output);
    throw new GitFailedException(Resources.commitCommand, output);
  }

  private static isHookRefusal(result: ProgramResult, errors: string): boolean {
    return result.exit.code === Resources.hookRefusedExitCode && result.output.length === 0 && !Resources.commitAbortedPattern.test(errors);
  }

  private static isStaged(entry: StatusEntry): boolean {
    return entry.conflict === null && !CommitWriter.UNSTAGED.includes(entry.index);
  }

  private static lineOf(entry: StatusEntry): string {
    const letter = Resources.stateLetters[entry.index];
    const target = LogReader.withoutControls(entry.path);
    return entry.originalPath === null ? Resources.formatStagedLine(letter, target) : Resources.formatRenamedLine(letter, LogReader.withoutControls(entry.originalPath), target);
  }
}
