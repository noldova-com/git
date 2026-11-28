/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import "@noldova/context.core";
import { type IPermissionRequest, PermissionOption, ToolRisk } from "@noldova/desktop.runtime";
import { GitNames, type GitStatus, UndoMode, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import type { IGitWrite } from "../interfaces/i-git-write.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import type { RepositoryFolders } from "../models/repository-folders.ts";
import { WritePermission } from "../models/write-permission.ts";
import { Resources } from "../resources.ts";
import type { HooksReader } from "./hooks.reader.ts";
import type { ProgramRunner } from "./program-runner.ts";
import type { SessionBranches } from "./session-branches.ts";

export class BranchCreateWriter implements IGitWrite {
  public readonly method: string = GitNames.createBranchMethod;
  public readonly undo: UndoMode = UndoMode.Switch;
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.writeOutputBytes, Resources.indexWriteMilliseconds);
  private static readonly READ_LIMITS: ProgramLimits = new ProgramLimits(Resources.lineOutputBytes, Resources.gitReadMilliseconds);
  private static readonly OPTIONS: readonly PermissionOption[] = [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny];
  private readonly runner: ProgramRunner;
  private readonly hooks: HooksReader;
  private readonly name: string;
  private readonly branches: SessionBranches;
  private readonly session: string | null;

  public constructor(runner: ProgramRunner, hooks: HooksReader, name: string, branches: SessionBranches, session: string | null) {
    this.runner = runner;
    this.hooks = hooks;
    this.name = name;
    this.branches = branches;
    this.session = session;
  }

  public refuse(): void {}

  public async requestAsync(folders: RepositoryFolders, _status: GitStatus, _call: unknown, signal?: AbortSignal): Promise<IPermissionRequest | null> {
    const hooks = await this.hooks.readAsync(folders.top, Resources.checkoutHooks, signal);
    if (!Object.isNull(hooks) && hooks.length === 0)
      return null;
    return WritePermission.create(
      GitNames.createBranchMethod,
      folders.top,
      Resources.formatCreateBranchTitle(this.name),
      [WritePermission.hooksDetail(hooks)],
      ToolRisk.Low,
      BranchCreateWriter.OPTIONS);
  }

  public async runAsync(folders: RepositoryFolders, _status: GitStatus, signal?: AbortSignal): Promise<void> {
    const onRemote = Object.isNull(this.session) ? false : await this.isOnRemoteAsync(folders.top, signal);
    const gitArguments = new GitArguments([...Resources.createBranchArguments, this.name]);
    const result = await this.runner.runAsync(ProgramRun.writeGit(gitArguments, folders.top, folders.gitFolder, folders.commonGitFolder, BranchCreateWriter.LIMITS, signal));
    if (result.exit.code !== 0)
      throw BranchCreateWriter.failure(Resources.formatGitCommand(gitArguments.options), result.errors);
    if (!Object.isNull(this.session) && !onRemote)
      this.branches.add(this.session, folders.top, this.name);
  }

  private async isOnRemoteAsync(top: string, signal?: AbortSignal): Promise<boolean> {
    const gitArguments = new GitArguments([...Resources.remoteBranchArguments, Resources.formatRemoteBranchGlob(this.name)]);
    const result = await this.runner.runAsync(ProgramRun.readGit(gitArguments, top, BranchCreateWriter.READ_LIMITS, signal));
    if (result.exit.code !== 0)
      throw BranchCreateWriter.failure(Resources.forEachRefCommand, result.errors);
    return result.output.length > 0;
  }

  private static failure(command: string, errors: Buffer): GitFailedException {
    return new GitFailedException(command, { text: errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
  }
}
