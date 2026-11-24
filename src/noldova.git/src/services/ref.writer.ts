/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IPermissionRequest } from "@noldova/desktop.runtime";
import { type GitStatus, UndoMode, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import type { GitFailureException } from "../exceptions/git-failure.exception.ts";
import type { IGitWrite } from "../interfaces/i-git-write.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import type { RepositoryFolders } from "../models/repository-folders.ts";
import { Resources } from "../resources.ts";
import type { ProgramRunner } from "./program-runner.ts";

/**
 * Renames or deletes a branch, or makes or deletes a tag, leaving the worktree and index as they are; for the person's own click only.
 * A name that is already taken fails as the given exception, and any other failure as git's own message.
 */
export class RefWriter implements IGitWrite {
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.writeOutputBytes, Resources.indexWriteMilliseconds);
  private readonly runner: ProgramRunner;
  private readonly gitArguments: readonly string[];
  private readonly command: string;
  private readonly taken: GitFailureException | null;
  public readonly method: string;
  /** The journal puts back the refs the write moved. */
  public readonly undo: UndoMode = UndoMode.Refs;

  public constructor(runner: ProgramRunner, method: string, gitArguments: readonly string[], command: string, taken: GitFailureException | null) {
    this.runner = runner;
    this.method = method;
    this.gitArguments = gitArguments;
    this.command = command;
    this.taken = taken;
  }

  public refuse(): void {}

  /** Never asks: only the person's own click makes one, and no agent tool offers it. */
  public async requestAsync(): Promise<IPermissionRequest | null> {
    return null;
  }

  public async runAsync(folders: RepositoryFolders, _status: GitStatus, signal?: AbortSignal): Promise<void> {
    const gitArguments = new GitArguments(this.gitArguments);
    const result = await this.runner.runAsync(ProgramRun.writeGit(gitArguments, folders.top, folders.gitFolder, folders.commonGitFolder, RefWriter.LIMITS, signal));
    if (result.exit.code === 0)
      return;
    const text = result.errors.toString(Resources.utf8Encoding);
    if (this.taken !== null && Resources.branchExistsPattern.test(text))
      throw this.taken;
    throw new GitFailedException(this.command, { text, source: UntrustedSource.Repository });
  }
}
