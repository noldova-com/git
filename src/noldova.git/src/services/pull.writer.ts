/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { type IPermissionRequest, PermissionOption, ToolRisk } from "@noldova/desktop.runtime";
import { GitNames, type GitStatus, UndoMode, UntrustedSource } from "@noldova/git.protocol";

import { CredentialsNeededException } from "../exceptions/credentials-needed.exception.ts";
import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { HostKeyUnknownException } from "../exceptions/host-key-unknown.exception.ts";
import { KeyRefusedException } from "../exceptions/key-refused.exception.ts";
import { PullChangesInTheWayException } from "../exceptions/pull-changes-in-the-way.exception.ts";
import { PullConflictsException } from "../exceptions/pull-conflicts.exception.ts";
import { PullDetachedException } from "../exceptions/pull-detached.exception.ts";
import { PullDivergedException } from "../exceptions/pull-diverged.exception.ts";
import { PullNoUpstreamException } from "../exceptions/pull-no-upstream.exception.ts";
import { UnsafeRepositoryException } from "../exceptions/unsafe-repository.exception.ts";
import type { IGitWrite } from "../interfaces/i-git-write.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import { PulledBranch } from "../models/pulled-branch.ts";
import type { RepositoryFolders } from "../models/repository-folders.ts";
import { WritePermission } from "../models/write-permission.ts";
import { Resources } from "../resources.ts";
import type { CheckoutRisksReader } from "./checkout-risks.reader.ts";
import { LogReader } from "./log.reader.ts";
import type { ProgramRunner } from "./program-runner.ts";

export class PullWriter implements IGitWrite {
  public readonly method: string = GitNames.pullMethod;
  public readonly undo: UndoMode = UndoMode.Keep;
  private static readonly PULL_LIMITS: ProgramLimits = new ProgramLimits(Resources.writeOutputBytes, Resources.checkoutMilliseconds);
  private static readonly COUNT_LIMITS: ProgramLimits = new ProgramLimits(Resources.lineOutputBytes, Resources.gitReadMilliseconds);
  private static readonly PULL: GitArguments = new GitArguments(Resources.pullArguments);
  private static readonly COUNTS: GitArguments = new GitArguments(Resources.aheadBehindArguments);
  private static readonly OPTIONS: readonly PermissionOption[] = [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny];
  private readonly runner: ProgramRunner;
  private readonly risks: CheckoutRisksReader;

  public constructor(runner: ProgramRunner, risks: CheckoutRisksReader) {
    this.runner = runner;
    this.risks = risks;
  }

  public refuse(status: GitStatus): void {
    PullWriter.pulledOf(status);
  }

  public async requestAsync(folders: RepositoryFolders, status: GitStatus, _call: unknown, signal?: AbortSignal): Promise<IPermissionRequest | null> {
    const pulled = PullWriter.pulledOf(status);
    const risks = await this.risks.readAsync(folders.top, Resources.pullHooks, Resources.checkoutHooks, signal);
    return WritePermission.create(GitNames.pullMethod, folders.top, Resources.formatPullTitle(pulled.upstream.name, pulled.branch), [
      WritePermission.hooksDetail(risks.hooks),
      ...risks.filters.length === 0 ? [] : [WritePermission.filtersDetail(risks.filters)]
    ], ToolRisk.Medium, PullWriter.OPTIONS);
  }

  public async runAsync(folders: RepositoryFolders, _status: GitStatus, signal?: AbortSignal): Promise<void> {
    const result = await this.runner.runAsync(ProgramRun.writeGit(PullWriter.PULL, folders.top, folders.gitFolder, folders.commonGitFolder, PullWriter.PULL_LIMITS, signal));
    if (result.exit.code === 0)
      return;
    const errors = result.errors.toString(Resources.utf8Encoding);
    const output = { text: errors, source: UntrustedSource.Repository };
    const files = Resources.overwrittenByMergePattern.exec(errors.replaceAll(Resources.crlf, Resources.lineEnd))?.groups?.[Resources.filesGroup];
    if (files !== undefined) {
      const paths = files.split(Resources.lineEnd).filter(t => t.length > 0).map(t => LogReader.toLine(t.slice(1)));
      throw new PullChangesInTheWayException(paths, output);
    }
    const unsafe = Resources.unsafeRepositoryPattern.exec(errors)?.groups?.[Resources.folderGroup];
    if (unsafe !== undefined)
      throw new UnsafeRepositoryException(LogReader.toLine(unsafe), output);
    if (Resources.hostKeyFailedPattern.test(errors))
      throw new HostKeyUnknownException(output);
    if (Resources.keyRefusedPattern.test(errors))
      throw new KeyRefusedException(output);
    if (Resources.credentialsPattern.test(errors))
      throw new CredentialsNeededException(output);
    if (await this.hasDivergedAsync(folders.top, signal))
      throw new PullDivergedException();
    throw new GitFailedException(Resources.pullCommand, output);
  }

  private static pulledOf(status: GitStatus): PulledBranch {
    if (status.branch === null)
      throw new PullDetachedException();
    if (status.upstream === null || status.upstream.gone)
      throw new PullNoUpstreamException();
    if (status.operation !== null || status.entries.some(t => t.conflict !== null))
      throw new PullConflictsException();
    if (status.upstream.ahead > 0 && status.upstream.behind > 0)
      throw new PullDivergedException();
    return new PulledBranch(status.branch, status.upstream);
  }

  private async hasDivergedAsync(top: string, signal?: AbortSignal): Promise<boolean> {
    const result = await this.runner.runAsync(ProgramRun.readGit(PullWriter.COUNTS, top, PullWriter.COUNT_LIMITS, signal));
    const counts = result.exit.code === 0 ? Resources.aheadBehindPattern.exec(result.output.toString(Resources.utf8Encoding))?.groups : undefined;
    return counts !== undefined && Number(counts[Resources.aheadGroup]) > 0 && Number(counts[Resources.behindGroup]) > 0;
  }
}
