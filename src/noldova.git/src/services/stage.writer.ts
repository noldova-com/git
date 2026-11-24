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
import type { IGitWrite } from "../interfaces/i-git-write.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { PathBatches } from "../models/path-batches.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import type { RepositoryFolders } from "../models/repository-folders.ts";
import { WritePermission } from "../models/write-permission.ts";
import { Resources } from "../resources.ts";
import type { FilterOptionsReader } from "./filter-options.reader.ts";
import type { HooksReader } from "./hooks.reader.ts";
import { LogReader } from "./log.reader.ts";
import type { ProgramRunner } from "./program-runner.ts";

export class StageWriter implements IGitWrite {
  public readonly method: string = GitNames.stageMethod;
  public readonly undo: UndoMode = UndoMode.Index;
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.writeOutputBytes, Resources.indexWriteMilliseconds);
  private static readonly ARGUMENTS: GitArguments = new GitArguments(Resources.stageArguments);
  private static readonly OPTIONS: readonly PermissionOption[] = [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny];
  private readonly runner: ProgramRunner;
  private readonly hooks: HooksReader;
  private readonly filters: FilterOptionsReader;
  private readonly paths: readonly string[];

  public constructor(runner: ProgramRunner, hooks: HooksReader, filters: FilterOptionsReader, paths: readonly string[]) {
    this.runner = runner;
    this.hooks = hooks;
    this.filters = filters;
    this.paths = paths;
  }

  public refuse(): void {}

  public async requestAsync(folders: RepositoryFolders, _status: GitStatus, _call: unknown, signal?: AbortSignal): Promise<IPermissionRequest | null> {
    const hooks = await this.hooks.readAsync(folders.top, Resources.indexHooks, signal);
    const filters = await this.filters.namesAsync(folders.top, Resources.stageFilterKinds, signal);
    if (hooks !== null && hooks.length === 0 && filters.length === 0)
      return null;
    return WritePermission.create(
      GitNames.stageMethod,
      folders.top,
      Resources.formatStageTitle(this.paths.length),
      [
        { label: Resources.filesLabel, kind: PermissionDetailKind.Code, value: this.paths.map(t => LogReader.withoutControls(t)).join(Resources.lineEnd) },
        WritePermission.hooksDetail(hooks),
        ...filters.length === 0 ? [] : [WritePermission.filtersDetail(filters.map(t => LogReader.withoutControls(t)))]
      ],
      ToolRisk.Low,
      StageWriter.OPTIONS);
  }

  public async runAsync(folders: RepositoryFolders, _status: GitStatus, signal?: AbortSignal): Promise<void> {
    for (const batch of PathBatches.split(this.paths)) {
      const run = ProgramRun.writeGit(StageWriter.ARGUMENTS.withPaths(batch), folders.top, folders.gitFolder, folders.commonGitFolder, StageWriter.LIMITS, signal);
      const result = await this.runner.runAsync(run);
      if (result.exit.code !== 0)
        throw new GitFailedException(Resources.addCommand, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
    }
  }
}
