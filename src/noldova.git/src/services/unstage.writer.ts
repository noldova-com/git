/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { type IPermissionRequest, PermissionDetailKind, PermissionOption, ToolRisk } from "@noldova/desktop.runtime";
import { GitNames, type GitStatus, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import type { IGitWrite } from "../interfaces/i-git-write.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { PathBatches } from "../models/path-batches.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import type { RepositoryFolders } from "../models/repository-folders.ts";
import { WritePermission } from "../models/write-permission.ts";
import { Resources } from "../resources.ts";
import type { HooksReader } from "./hooks.reader.ts";
import { LogReader } from "./log.reader.ts";
import type { ProgramRunner } from "./program-runner.ts";

export class UnstageWriter implements IGitWrite {
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.writeOutputBytes, Resources.indexWriteMilliseconds);
  private static readonly RESTORE: GitArguments = new GitArguments(Resources.restoreStagedArguments);
  private static readonly REMOVE: GitArguments = new GitArguments(Resources.removeCachedArguments);
  private static readonly OPTIONS: readonly PermissionOption[] = [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny];
  private readonly runner: ProgramRunner;
  private readonly hooks: HooksReader;
  private readonly paths: readonly string[];

  public constructor(runner: ProgramRunner, hooks: HooksReader, paths: readonly string[]) {
    this.runner = runner;
    this.hooks = hooks;
    this.paths = paths;
  }

  public refuse(): void {}

  public async requestAsync(folders: RepositoryFolders, _status: GitStatus, _call: unknown, signal?: AbortSignal): Promise<IPermissionRequest | null> {
    const hooks = await this.hooks.readAsync(folders.top, Resources.indexHooks, signal);
    if (hooks !== null && hooks.length === 0)
      return null;
    return WritePermission.create(
      GitNames.unstageMethod,
      folders.top,
      Resources.formatUnstageTitle(this.paths.length),
      [
        { label: Resources.filesLabel, kind: PermissionDetailKind.Code, value: this.paths.map(t => LogReader.withoutControls(t)).join(Resources.lineEnd) },
        WritePermission.hooksDetail(hooks)
      ],
      ToolRisk.Low,
      UnstageWriter.OPTIONS);
  }

  public async runAsync(folders: RepositoryFolders, status: GitStatus, signal?: AbortSignal): Promise<void> {
    const gitArguments = status.head === null ? UnstageWriter.REMOVE : UnstageWriter.RESTORE;
    for (const batch of PathBatches.split(this.paths)) {
      const run = ProgramRun.writeGit(gitArguments.withPaths(batch), folders.top, folders.gitFolder, folders.commonGitFolder, UnstageWriter.LIMITS, signal);
      const result = await this.runner.runAsync(run);
      if (result.exit.code !== 0)
        throw new GitFailedException(Resources.formatGitCommand(gitArguments.options), { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
    }
  }
}
