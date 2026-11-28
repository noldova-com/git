/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import "@noldova/context.core";
import { GitWorktree, GitWorktrees, ProtocolException, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { UnreadableOutputException } from "../exceptions/unreadable-output.exception.ts";
import { WorktreeListTruncatedException } from "../exceptions/worktree-list-truncated.exception.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import { Resources } from "../resources.ts";
import type { ProgramRunner } from "./program-runner.ts";
import { WorktreeListParser } from "./worktree-list.parser.ts";

export class WorktreesReader {
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.worktreesReadBytes, Resources.gitReadMilliseconds);
  private static readonly ARGUMENTS: GitArguments = new GitArguments(Resources.worktreeListArguments);
  private readonly runner: ProgramRunner;

  public constructor(runner: ProgramRunner) {
    this.runner = runner;
  }

  public async readAsync(top: string, signal?: AbortSignal): Promise<GitWorktrees> {
    const result = await this.runner.runAsync(ProgramRun.readGit(WorktreesReader.ARGUMENTS, top, WorktreesReader.LIMITS, signal));
    if (result.exit.code !== 0)
      throw new GitFailedException(Resources.worktreeListCommand, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
    if (result.isTruncated)
      throw new WorktreeListTruncatedException();
    try {
      return new GitWorktrees(WorktreeListParser.parse(result.output).map(t =>
        new GitWorktree(t.path, Object.isNull(t.head) || Resources.zeroIdPattern.test(t.head) ? null : t.head, t.branch, t.isLocked, t.isPrunable)));
    } catch (error) {
      if (error instanceof ProtocolException)
        throw new UnreadableOutputException(Resources.worktreeListCommand, Resources.worktreesPart, error);
      throw error;
    }
  }
}
