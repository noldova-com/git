/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IPermissionRequest } from "@noldova/desktop.runtime";
import { FileState, GitNames, type GitStatus, type StatusEntry, UndoMode, UntrustedSource } from "@noldova/git.protocol";

import { DiscardRefusedException } from "../exceptions/discard-refused.exception.ts";
import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import type { IGitWrite } from "../interfaces/i-git-write.ts";
import type { IWriteCheckpoint } from "../interfaces/i-write-checkpoint.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { PathBatches } from "../models/path-batches.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import type { RepositoryFolders } from "../models/repository-folders.ts";
import { Resources } from "../resources.ts";
import type { CheckpointStore } from "./checkpoint-store.ts";
import type { ProgramRunner } from "./program-runner.ts";

/**
 * Discards paths' working-folder changes, a person's own click in the Git view: a tracked path goes back to its
 * staged content, with `git restore --worktree`, and an untracked one is removed, with `git clean`. It refuses a
 * path with nothing to put back, a conflicted path and a submodule, before anything runs. When the app includes the checkpoints module and
 * it is on, the writer takes a checkpoint of the working folder first, and doesn't discard if that fails; the journal then undoes the discard
 * by putting its paths back from the checkpoint. Without the module, the discard can't be undone.
 */
export class DiscardWriter implements IGitWrite {
  public readonly method: string = GitNames.discardMethod;
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.writeOutputBytes, Resources.indexWriteMilliseconds);
  private static readonly RESTORE: GitArguments = new GitArguments(Resources.restoreWorktreeArguments);
  private static readonly CLEAN: GitArguments = new GitArguments(Resources.cleanArguments);
  private readonly runner: ProgramRunner;
  private readonly paths: readonly string[];
  private readonly checkpoints: CheckpointStore;

  public checkpoint: IWriteCheckpoint | null = null;

  public constructor(runner: ProgramRunner, paths: readonly string[], checkpoints: CheckpointStore) {
    this.runner = runner;
    this.paths = paths;
    this.checkpoints = checkpoints;
  }

  /** {@link UndoMode.Checkpoint} once a checkpoint was taken before the discard, and {@link UndoMode.None} without one. */
  public get undo(): UndoMode {
    return this.checkpoint === null ? UndoMode.None : UndoMode.Checkpoint;
  }

  public refuse(status: GitStatus): void {
    for (const path of this.paths) {
      const entry = status.entries.find(t => t.path === path);
      // A conflicted path's states are Unmodified, as the protocol reads them, so it is refused with the unchanged ones.
      if (entry === undefined || entry.worktree === FileState.Unmodified || entry.submodule !== null)
        throw new DiscardRefusedException(path);
    }
  }

  public requestAsync(): Promise<IPermissionRequest | null> {
    return Promise.resolve(null);
  }

  public async runAsync(folders: RepositoryFolders, status: GitStatus, signal?: AbortSignal): Promise<void> {
    const id = await this.checkpoints.captureAsync(folders.top, Resources.formatDiscardLabel(this.paths.length), signal);
    this.checkpoint = id === null ? null : { id, paths: this.paths };
    const untracked = new Set(status.entries.filter(t => DiscardWriter.isUntracked(t)).map(t => t.path));
    await this.runEachAsync(DiscardWriter.RESTORE, this.paths.filter(t => !untracked.has(t)), folders, signal);
    await this.runEachAsync(DiscardWriter.CLEAN, this.paths.filter(t => untracked.has(t)), folders, signal);
  }

  private static isUntracked(entry: StatusEntry): boolean {
    return entry.index === FileState.Untracked;
  }

  private async runEachAsync(gitArguments: GitArguments, paths: readonly string[], folders: RepositoryFolders, signal?: AbortSignal): Promise<void> {
    for (const batch of PathBatches.split(paths)) {
      const run = ProgramRun.writeGit(gitArguments.withPaths(batch), folders.top, folders.gitFolder, folders.commonGitFolder, DiscardWriter.LIMITS, signal);
      const result = await this.runner.runAsync(run);
      if (result.exit.code !== 0)
        throw new GitFailedException(Resources.formatGitCommand(gitArguments.options), { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
    }
  }
}
