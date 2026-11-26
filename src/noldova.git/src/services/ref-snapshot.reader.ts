/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import type { ProgramResult } from "../models/program-result.ts";
import { ProgramRun } from "../models/program-run.ts";
import { RefSnapshot } from "../models/ref-snapshot.ts";
import type { RepositoryFolders } from "../models/repository-folders.ts";
import { Resources } from "../resources.ts";
import type { ProgramRunner } from "./program-runner.ts";

export class RefSnapshotReader {
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.writeOutputBytes, Resources.gitReadMilliseconds);
  private static readonly LINE_LIMITS: ProgramLimits = new ProgramLimits(Resources.lineOutputBytes, Resources.gitReadMilliseconds);
  private static readonly REFS: GitArguments = new GitArguments(Resources.snapshotRefsArguments);
  private static readonly BRANCH: GitArguments = new GitArguments(Resources.snapshotBranchArguments);
  private static readonly HEAD: GitArguments = new GitArguments(Resources.snapshotHeadArguments);
  private static readonly TREE: GitArguments = new GitArguments(Resources.writeTreeArguments);
  private readonly runner: ProgramRunner;

  public constructor(runner: ProgramRunner) {
    this.runner = runner;
  }

  public async readAsync(folders: RepositoryFolders, withIndex: boolean, signal?: AbortSignal): Promise<RefSnapshot> {
    const [refs, branch, head] = await Promise.all([
      this.runner.runAsync(ProgramRun.readGit(RefSnapshotReader.REFS, folders.top, RefSnapshotReader.LIMITS, signal)),
      this.runner.runAsync(ProgramRun.readGit(RefSnapshotReader.BRANCH, folders.top, RefSnapshotReader.LINE_LIMITS, signal)),
      this.runner.runAsync(ProgramRun.readGit(RefSnapshotReader.HEAD, folders.top, RefSnapshotReader.LINE_LIMITS, signal))
    ]);
    RefSnapshotReader.require(refs, 0, RefSnapshotReader.REFS);
    RefSnapshotReader.require(branch, Resources.notSymbolicExitCode, RefSnapshotReader.BRANCH);
    RefSnapshotReader.require(head, Resources.notSymbolicExitCode, RefSnapshotReader.HEAD);
    const index = withIndex ? await this.readIndexAsync(folders, signal) : null;
    return new RefSnapshot(
      branch.exit.code === 0 ? RefSnapshotReader.lineOf(branch).slice(Resources.branchRefsPrefix.length) : null,
      head.exit.code === 0 ? RefSnapshotReader.lineOf(head) : null,
      RefSnapshotReader.refsOf(refs.output.toString(Resources.utf8Encoding)),
      index);
  }

  private async readIndexAsync(folders: RepositoryFolders, signal?: AbortSignal): Promise<string | null> {
    const tree = await this.runner.runAsync(
      ProgramRun.writeGit(RefSnapshotReader.TREE, folders.top, folders.gitFolder, folders.commonGitFolder, RefSnapshotReader.LINE_LIMITS, signal).unlogged());
    return tree.exit.code === 0 ? RefSnapshotReader.lineOf(tree) : null;
  }

  private static require(result: ProgramResult, allowed: number, gitArguments: GitArguments): void {
    if (result.exit.code !== 0 && result.exit.code !== allowed)
      throw new GitFailedException(Resources.formatGitCommand(gitArguments.values), { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
  }

  private static lineOf(result: ProgramResult): string {
    return result.output.toString(Resources.utf8Encoding).replace(Resources.lineEndPattern, "");
  }

  private static refsOf(output: string): Map<string, string> {
    const refs = new Map<string, string>();
    for (const line of output.split(Resources.lineEnd)) {
      const end = line.indexOf(Resources.nulCharacter);
      if (end > 0)
        refs.set(line.slice(0, end), line.slice(end + 1));
    }
    return refs;
  }
}
