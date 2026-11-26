/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IPermissionRequest } from "@noldova/desktop.runtime";
import { FileState, GitNames, type GitStatus, type StatusEntry, UndoMode, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { NothingToStashException } from "../exceptions/nothing-to-stash.exception.ts";
import type { IGitWrite } from "../interfaces/i-git-write.ts";
import type { IWriteCheckpoint } from "../interfaces/i-write-checkpoint.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import type { RepositoryFolders } from "../models/repository-folders.ts";
import { Resources } from "../resources.ts";
import type { ProgramRunner } from "./program-runner.ts";

export class StashWriter implements IGitWrite {
  public readonly method: string = GitNames.stashMethod;
  public readonly undo: UndoMode = UndoMode.Stash;
  public checkpoint: IWriteCheckpoint | null = null;
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.writeOutputBytes, Resources.longWriteMilliseconds);
  private static readonly READ_LIMITS: ProgramLimits = new ProgramLimits(Resources.lineOutputBytes, Resources.gitReadMilliseconds);
  private static readonly STASH_ID: GitArguments = new GitArguments(Resources.stashIdArguments);
  private static readonly LEFT_OUT: ReadonlySet<FileState> = new Set([FileState.Untracked, FileState.Ignored]);
  private readonly runner: ProgramRunner;
  private readonly message: string | null;
  private readonly includeUntracked: boolean;

  public constructor(runner: ProgramRunner, message: string | null, includeUntracked: boolean) {
    this.runner = runner;
    this.message = message;
    this.includeUntracked = includeUntracked;
  }

  public refuse(status: GitStatus): void {
    if (!status.entries.some(t => this.takes(t)))
      throw new NothingToStashException();
  }

  public async requestAsync(): Promise<IPermissionRequest | null> {
    return null;
  }

  public async runAsync(folders: RepositoryFolders, status: GitStatus, signal?: AbortSignal): Promise<void> {
    const before: string | null = await this.readAsync(folders, StashWriter.STASH_ID, signal);
    const values: string[] = [...Resources.stashPushArguments];
    if (this.includeUntracked)
      values.push(Resources.includeUntrackedOption);
    if (this.message !== null)
      values.push(Resources.stashMessageOption, this.message);
    values.push(...Resources.stashWholeFolder);
    await this.gitAsync(ProgramRun.writeGit(new GitArguments(values), folders.top, folders.gitFolder, folders.commonGitFolder, StashWriter.LIMITS, signal));
    const id: string | null = await this.readAsync(folders, StashWriter.STASH_ID, signal);
    if (id === null || id === before || await this.readAsync(folders, new GitArguments(Resources.formatStashBaseArguments(id)), signal) !== status.head)
      throw new NothingToStashException();
    this.checkpoint = { id, paths: [] };
  }

  private takes(entry: StatusEntry): boolean {
    if (entry.index === FileState.Unmodified && entry.submodule !== null && !entry.submodule.commitChanged)
      return false;
    return !StashWriter.LEFT_OUT.has(entry.index) || (this.includeUntracked && entry.index === FileState.Untracked);
  }

  private async readAsync(folders: RepositoryFolders, gitArguments: GitArguments, signal?: AbortSignal): Promise<string | null> {
    const result = await this.runner.runAsync(ProgramRun.readGit(gitArguments, folders.top, StashWriter.READ_LIMITS, signal));
    return result.exit.code === 0 ? result.output.toString(Resources.utf8Encoding).trim() : null;
  }

  private async gitAsync(run: ProgramRun): Promise<void> {
    const result = await this.runner.runAsync(run);
    if (result.exit.code !== 0)
      throw new GitFailedException(Resources.stashCommand, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
  }
}
