/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { IPermissionRequest } from "@noldova/desktop.runtime";
import { GitNames, type GitStatus, UndoMode, UntrustedSource } from "@noldova/git.protocol";

import { CredentialsNeededException } from "../exceptions/credentials-needed.exception.ts";
import { FetchNoUpstreamException } from "../exceptions/fetch-no-upstream.exception.ts";
import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { HostKeyUnknownException } from "../exceptions/host-key-unknown.exception.ts";
import { KeyRefusedException } from "../exceptions/key-refused.exception.ts";
import { UnsafeRepositoryException } from "../exceptions/unsafe-repository.exception.ts";
import type { IGitWrite } from "../interfaces/i-git-write.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import type { RepositoryFolders } from "../models/repository-folders.ts";
import { Resources } from "../resources.ts";
import { LogReader } from "./log.reader.ts";
import type { ProgramRunner } from "./program-runner.ts";

/**
 * Fetches the current branch's remote, so the status shows its upstream as the remote has it, or every remote with `git fetch --all`; the branch, index and
 * working folder stay as they are. Only the person's own click runs it, and no agent tool offers it.
 */
export class FetchWriter implements IGitWrite {
  public readonly method: string = GitNames.fetchMethod;
  public readonly undo: UndoMode = UndoMode.None;
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.writeOutputBytes, Resources.longWriteMilliseconds);
  private static readonly FETCH: GitArguments = new GitArguments(Resources.fetchArguments);
  private static readonly FETCH_ALL: GitArguments = new GitArguments(Resources.fetchAllArguments);
  private readonly runner: ProgramRunner;
  private readonly allRemotes: boolean;

  public constructor(runner: ProgramRunner, allRemotes: boolean = false) {
    this.runner = runner;
    this.allRemotes = allRemotes;
  }

  /**
   * Refuses a detached HEAD, a branch with no upstream and one whose upstream is gone, since git would have no remote of the branch's to fetch; a fetch of
   * every remote needs no branch of its own.
   */
  public refuse(status: GitStatus): void {
    if (!this.allRemotes && (status.branch === null || status.upstream === null || status.upstream.gone))
      throw new FetchNoUpstreamException();
  }

  /** Never asks: only the person's own click makes one, and no agent tool offers it. */
  public async requestAsync(): Promise<IPermissionRequest | null> {
    return null;
  }

  public async runAsync(folders: RepositoryFolders, _status: GitStatus, signal?: AbortSignal): Promise<void> {
    const gitArguments = this.allRemotes ? FetchWriter.FETCH_ALL : FetchWriter.FETCH;
    const result = await this.runner.runAsync(ProgramRun.writeGit(gitArguments, folders.top, folders.gitFolder, folders.commonGitFolder, FetchWriter.LIMITS, signal));
    if (result.exit.code === 0)
      return;
    const errors = result.errors.toString(Resources.utf8Encoding);
    const output = { text: errors, source: UntrustedSource.Repository };
    const unsafe = Resources.unsafeRepositoryPattern.exec(errors)?.groups?.[Resources.folderGroup];
    if (unsafe !== undefined)
      throw new UnsafeRepositoryException(LogReader.toLine(unsafe), output);
    if (Resources.hostKeyFailedPattern.test(errors))
      throw new HostKeyUnknownException(output);
    if (Resources.keyRefusedPattern.test(errors))
      throw new KeyRefusedException(output);
    if (Resources.credentialsPattern.test(errors))
      throw new CredentialsNeededException(output);
    throw new GitFailedException(Resources.fetchCommand, output);
  }
}
