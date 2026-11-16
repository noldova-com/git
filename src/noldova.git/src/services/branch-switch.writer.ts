/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { type IPermissionRequest, PermissionDetailKind, PermissionOption, ToolRisk } from "@noldova/desktop.runtime";
import { FileState, GitNames, type GitStatus, UntrustedSource } from "@noldova/git.protocol";

import { AlreadyOnBranchException } from "../exceptions/already-on-branch.exception.ts";
import { BranchCheckedOutException } from "../exceptions/branch-checked-out.exception.ts";
import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { SwitchChangesInTheWayException } from "../exceptions/switch-changes-in-the-way.exception.ts";
import { SwitchDuringOperationException } from "../exceptions/switch-during-operation.exception.ts";
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
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.writeOutputBytes, Resources.checkoutMilliseconds);
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
    if (status.operation !== null)
      throw new SwitchDuringOperationException();
    if (status.branch === this.name)
      throw new AlreadyOnBranchException(this.name);
  }

  public async requestAsync(folders: RepositoryFolders, status: GitStatus, _call: unknown, signal?: AbortSignal): Promise<IPermissionRequest | null> {
    const unstaged = status.entries.filter(t => t.worktree !== FileState.Unmodified).length;
    const risks = await this.risks.readAsync(folders.top, Resources.checkoutHooks, Resources.moveHooks, signal);
    return WritePermission.create(
      GitNames.switchBranchMethod,
      folders.top,
      Resources.formatSwitchTitle(status.branch, this.name),
      [
        { label: Resources.changesLabel, kind: PermissionDetailKind.Text, value: Resources.formatUnstagedStay(unstaged) },
        WritePermission.hooksDetail(risks.hooks),
        ...risks.filters.length === 0 ? [] : [WritePermission.filtersDetail(risks.filters)]
      ],
      ToolRisk.Medium,
      BranchSwitchWriter.OPTIONS);
  }

  public async runAsync(folders: RepositoryFolders, _status: GitStatus, signal?: AbortSignal): Promise<void> {
    const gitArguments = new GitArguments([Resources.switchCommand, this.name]);
    const result = await this.runner.runAsync(ProgramRun.writeGit(gitArguments, folders.top, folders.gitFolder, folders.commonGitFolder, BranchSwitchWriter.LIMITS, signal));
    if (result.exit.code === 0)
      return;
    const errors = result.errors.toString(Resources.utf8Encoding);
    const output = { text: errors, source: UntrustedSource.Repository };
    const overwritten = Resources.overwrittenByCheckoutPattern.exec(errors.replaceAll(Resources.crlf, Resources.lineEnd));
    if (overwritten !== null) {
      const paths = Required.at(overwritten, 1, Resources.switchCommand, Resources.overwrittenPathsPart).split(Resources.lineEnd).filter(t => t.length > 0).map(t => LogReader.toLine(t.slice(1)));
      throw new SwitchChangesInTheWayException(paths, output);
    }
    if (Resources.checkedOutPattern.test(errors))
      throw new BranchCheckedOutException(this.name, output);
    throw new GitFailedException(Resources.switchCommand, output);
  }
}
