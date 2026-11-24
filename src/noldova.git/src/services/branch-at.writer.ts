/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IPermissionRequest } from "@noldova/desktop.runtime";
import { GitNames, type GitStatus, UndoMode, UntrustedSource } from "@noldova/git.protocol";

import { BranchExistsException } from "../exceptions/branch-exists.exception.ts";
import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import type { IGitWrite } from "../interfaces/i-git-write.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import type { RepositoryFolders } from "../models/repository-folders.ts";
import { Resources } from "../resources.ts";
import type { ProgramRunner } from "./program-runner.ts";

/** Makes a branch at a commit without switching to it, so the worktree and index stay as they are; for the person's own click only. */
export class BranchAtWriter implements IGitWrite {
  public readonly method: string = GitNames.createBranchAtMethod;
  public readonly undo: UndoMode = UndoMode.Refs;
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.writeOutputBytes, Resources.indexWriteMilliseconds);
  private readonly runner: ProgramRunner;
  private readonly name: string;
  private readonly id: string;

  public constructor(runner: ProgramRunner, name: string, id: string) {
    this.runner = runner;
    this.name = name;
    this.id = id;
  }

  public refuse(): void {}

  /** Never asks: only the person's own click makes one, and no agent tool offers it. */
  public async requestAsync(): Promise<IPermissionRequest | null> {
    return null;
  }

  public async runAsync(folders: RepositoryFolders, _status: GitStatus, signal?: AbortSignal): Promise<void> {
    const gitArguments = new GitArguments([...Resources.createBranchAtArguments, this.name, this.id]);
    const result = await this.runner.runAsync(ProgramRun.writeGit(gitArguments, folders.top, folders.gitFolder, folders.commonGitFolder, BranchAtWriter.LIMITS, signal));
    if (result.exit.code === 0)
      return;
    const text = result.errors.toString(Resources.utf8Encoding);
    if (Resources.branchExistsPattern.test(text))
      throw new BranchExistsException(this.name);
    throw new GitFailedException(Resources.branchCommand, { text, source: UntrustedSource.Repository });
  }
}
