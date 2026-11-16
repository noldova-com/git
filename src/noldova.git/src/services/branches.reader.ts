/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { GitBranches, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import { Resources } from "../resources.ts";
import type { ProgramRunner } from "./program-runner.ts";

export class BranchesReader {
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.branchesReadBytes, Resources.gitReadMilliseconds);
  private static readonly HEADS: GitArguments = new GitArguments(Resources.branchHeadsArguments);
  private static readonly CURRENT: GitArguments = new GitArguments(Resources.currentBranchArguments);
  private static readonly REMOTES: GitArguments = new GitArguments(Resources.remotesArguments);
  private static readonly REMOTE_HEADS: GitArguments = new GitArguments(Resources.remoteHeadsArguments);
  private readonly runner: ProgramRunner;

  public constructor(runner: ProgramRunner) {
    this.runner = runner;
  }

  public async readAsync(top: string, signal?: AbortSignal): Promise<GitBranches> {
    const [heads, current, remotes, remoteHeads] = await Promise.all([
      this.runAsync(BranchesReader.HEADS, top, Resources.forEachRefCommand, signal),
      this.runner.runAsync(ProgramRun.readGit(BranchesReader.CURRENT, top, BranchesReader.LIMITS, signal)),
      this.runAsync(BranchesReader.REMOTES, top, Resources.remoteCommand, signal),
      this.runAsync(BranchesReader.REMOTE_HEADS, top, Resources.forEachRefCommand, signal)
    ]);
    if (current.exit.code !== 0 && current.exit.code !== Resources.notSymbolicExitCode)
      throw BranchesReader.failure(Resources.symbolicRefCommand, current.errors);
    return new GitBranches(current.exit.code === 0 ? BranchesReader.branchOf(current.output.toString(Resources.utf8Encoding).trim()) : null,
      BranchesReader.refsOf(heads, Resources.branchRefsPrefix),
      remotes.split(Resources.linePattern).filter(t => t.length > 0),
      BranchesReader.refsOf(remoteHeads, Resources.remoteRefsPrefix).filter(t => !t.endsWith(Resources.remoteHeadSuffix)));
  }

  private async runAsync(gitArguments: GitArguments, top: string, command: string, signal?: AbortSignal): Promise<string> {
    const result = await this.runner.runAsync(ProgramRun.readGit(gitArguments, top, BranchesReader.LIMITS, signal));
    if (result.exit.code !== 0)
      throw BranchesReader.failure(command, result.errors);
    return result.output.toString(Resources.utf8Encoding);
  }

  private static failure(command: string, errors: Buffer): GitFailedException {
    return new GitFailedException(command, { text: errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
  }

  private static refsOf(output: string, prefix: string): string[] {
    return output.split(Resources.recordSeparator).map(t => t.trim()).filter(t => t.startsWith(prefix)).map(t => t.slice(prefix.length))
      .filter(t => t.length > 0);
  }

  private static branchOf(ref: string): string | null {
    const branch = ref.startsWith(Resources.branchRefsPrefix) ? ref.slice(Resources.branchRefsPrefix.length) : "";
    return branch.length === 0 ? null : branch;
  }
}
