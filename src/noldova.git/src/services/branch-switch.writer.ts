/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import "@noldova/context.core";
import { type IPermissionRequest, PermissionDetailKind, PermissionOption, ToolRisk } from "@noldova/desktop.runtime";
import { FileState, GitNames, type GitStatus, UndoMode, UntrustedSource } from "@noldova/git.protocol";

import { AlreadyOnBranchException } from "../exceptions/already-on-branch.exception.ts";
import { BranchCheckedOutException } from "../exceptions/branch-checked-out.exception.ts";
import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { SwitchChangesInTheWayException } from "../exceptions/switch-changes-in-the-way.exception.ts";
import { SwitchDuringOperationException } from "../exceptions/switch-during-operation.exception.ts";
import { SwitchNoBranchException } from "../exceptions/switch-no-branch.exception.ts";
import { SwitchRemoteAmbiguousException } from "../exceptions/switch-remote-ambiguous.exception.ts";
import type { IGitWrite } from "../interfaces/i-git-write.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import type { RepositoryFolders } from "../models/repository-folders.ts";
import { Required } from "../models/required.ts";
import { WritePermission } from "../models/write-permission.ts";
import { Resources } from "../resources.ts";
import type { CheckoutRisksReader } from "./checkout-risks.reader.ts";
import { LogReader } from "./log.reader.ts";
import type { ProgramRunner } from "./program-runner.ts";

export class BranchSwitchWriter implements IGitWrite {
  public readonly method: string = GitNames.switchBranchMethod;
  public readonly undo: UndoMode = UndoMode.Switch;
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.writeOutputBytes, Resources.checkoutMilliseconds);
  private static readonly READ_LIMITS: ProgramLimits = new ProgramLimits(Resources.lineOutputBytes, Resources.gitReadMilliseconds);
  private static readonly SHOW_BRANCH: GitArguments = new GitArguments(Resources.showRefArguments);
  private static readonly REMOTES: GitArguments = new GitArguments(Resources.remotesArguments);
  private static readonly DEFAULT_REMOTE: GitArguments = new GitArguments(Resources.defaultRemoteArguments);
  private static readonly OPTIONS: readonly PermissionOption[] = [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny];
  private readonly runner: ProgramRunner;
  private readonly risks: CheckoutRisksReader;
  private readonly name: string;

  public constructor(runner: ProgramRunner, risks: CheckoutRisksReader, name: string) {
    this.runner = runner;
    this.risks = risks;
    this.name = name;
  }

  public refuse(status: GitStatus): void {
    if (!Object.isNull(status.operation))
      throw new SwitchDuringOperationException();
    if (status.branch === this.name)
      throw new AlreadyOnBranchException(this.name);
  }

  public async requestAsync(folders: RepositoryFolders, status: GitStatus, _call: unknown, signal?: AbortSignal): Promise<IPermissionRequest | null> {
    const unstaged = status.entries.filter(t => t.worktree !== FileState.Unmodified).length;
    const [risks, tracked] = await Promise.all([
      this.risks.readAsync(folders.top, Resources.checkoutHooks, Resources.moveHooks, signal),
      this.trackedAsync(folders.top, signal)
    ]);
    return WritePermission.create(
      GitNames.switchBranchMethod,
      folders.top,
      Object.isNull(tracked) ? Resources.formatSwitchTitle(status.branch, this.name) : Resources.formatSwitchNewTitle(status.branch, this.name, tracked),
      [
        { label: Resources.changesLabel, kind: PermissionDetailKind.Text, value: Resources.formatUnstagedStay(unstaged, status.truncated) },
        WritePermission.hooksDetail(risks.hooks),
        ...risks.filters.length === 0 ? [] : [WritePermission.filtersDetail(risks.filters)]
      ],
      ToolRisk.Medium,
      BranchSwitchWriter.OPTIONS);
  }

  private async trackedAsync(top: string, signal?: AbortSignal): Promise<string | null> {
    if (await this.hasBranchAsync(top, signal))
      return null;
    const remotes = BranchSwitchWriter.linesOf(await this.readAsync(BranchSwitchWriter.REMOTES, top, signal));
    const refs = remotes.map(t => Resources.formatRemoteBranchRef(t, this.name));
    const found = refs.length === 0 ? [] : BranchSwitchWriter.linesOf(await this.readAsync(new GitArguments([...Resources.remoteBranchRefsArguments, ...refs]), top, signal));
    const names = remotes.filter(t => found.includes(Resources.formatRemoteBranchRef(t, this.name)));
    const preferred = names.length > 1 ? await this.readDefaultRemoteAsync(top, signal) : null;
    const chosen = names.length > 1 ? names.find(t => t === preferred) : names.at(0);
    if (Object.isUndefined(chosen))
      throw names.length === 0 ? new SwitchNoBranchException(this.name) : new SwitchRemoteAmbiguousException(this.name, names);
    return `${Resources.formatRemotePrefix(chosen)}${this.name}`;
  }

  private async readDefaultRemoteAsync(top: string, signal?: AbortSignal): Promise<string | null> {
    const result = await this.runner.runAsync(ProgramRun.readGit(BranchSwitchWriter.DEFAULT_REMOTE, top, BranchSwitchWriter.READ_LIMITS, signal));
    if (result.exit.code === Resources.configNotFoundExitCode)
      return null;
    if (result.exit.code !== 0 || result.isTruncated)
      throw BranchSwitchWriter.failureOf(BranchSwitchWriter.DEFAULT_REMOTE, result.errors);
    return result.output.toString(Resources.utf8Encoding).replace(Resources.lineEndPattern, "");
  }

  private async readAsync(gitArguments: GitArguments, top: string, signal?: AbortSignal): Promise<string> {
    const result = await this.runner.runAsync(ProgramRun.readGit(gitArguments, top, BranchSwitchWriter.READ_LIMITS, signal));
    if (result.exit.code !== 0 || result.isTruncated)
      throw BranchSwitchWriter.failureOf(gitArguments, result.errors);
    return result.output.toString(Resources.utf8Encoding);
  }

  private static failureOf(gitArguments: GitArguments, errors: Buffer): GitFailedException {
    return new GitFailedException(Resources.formatGitCommand(gitArguments.values), { text: errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
  }

  private static linesOf(output: string): string[] {
    return output.split(Resources.lineEnd).filter(t => t.length > 0);
  }

  private async hasBranchAsync(top: string, signal?: AbortSignal): Promise<boolean> {
    const gitArguments = new GitArguments([...BranchSwitchWriter.SHOW_BRANCH.values, Resources.formatBranchRef(this.name)]);
    const result = await this.runner.runAsync(ProgramRun.readGit(gitArguments, top, BranchSwitchWriter.READ_LIMITS, signal));
    if (result.exit.code !== 0 && result.exit.code !== Resources.refMissingExitCode)
      throw new GitFailedException(Resources.formatGitCommand(BranchSwitchWriter.SHOW_BRANCH.values), { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
    return result.exit.code === 0;
  }

  public async runAsync(folders: RepositoryFolders, _status: GitStatus, signal?: AbortSignal): Promise<void> {
    const gitArguments = new GitArguments([Resources.switchCommand, this.name]);
    const result = await this.runner.runAsync(ProgramRun.writeGit(gitArguments, folders.top, folders.gitFolder, folders.commonGitFolder, BranchSwitchWriter.LIMITS, signal));
    if (result.exit.code === 0)
      return;
    const errors = result.errors.toString(Resources.utf8Encoding);
    const output = { text: errors, source: UntrustedSource.Repository };
    const overwritten = Resources.overwrittenByCheckoutPattern.exec(errors.replaceAll(Resources.crlf, Resources.lineEnd));
    if (!Object.isNull(overwritten)) {
      const paths = Required.at(overwritten, 1, Resources.switchCommand, Resources.overwrittenPathsPart).split(Resources.lineEnd).filter(t => t.length > 0).map(t => LogReader.toLine(t.slice(1)));
      throw new SwitchChangesInTheWayException(paths, output);
    }
    if (Resources.checkedOutPattern.test(errors))
      throw new BranchCheckedOutException(this.name, output);
    throw new GitFailedException(Resources.switchCommand, output);
  }
}
