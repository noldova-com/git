/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { type IPermissionDetail, type IPermissionRequest, PermissionDetailKind, PermissionOption, ToolRisk } from "@noldova/desktop.runtime";
import { GitNames, type GitRemote, type GitStatus, type StatusUpstream, UntrustedSource } from "@noldova/git.protocol";

import { CredentialsNeededException } from "../exceptions/credentials-needed.exception.ts";
import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import type { GitFailureException } from "../exceptions/git-failure.exception.ts";
import { HostKeyUnknownException } from "../exceptions/host-key-unknown.exception.ts";
import { KeyRefusedException } from "../exceptions/key-refused.exception.ts";
import { NothingToPushException } from "../exceptions/nothing-to-push.exception.ts";
import { PushBehindException } from "../exceptions/push-behind.exception.ts";
import { PushDetachedException } from "../exceptions/push-detached.exception.ts";
import { PushNoRemoteException } from "../exceptions/push-no-remote.exception.ts";
import { PushRejectedException } from "../exceptions/push-rejected.exception.ts";
import { UpstreamNotSetException } from "../exceptions/upstream-not-set.exception.ts";
import type { IGitWrite } from "../interfaces/i-git-write.ts";
import type { IUntrustedText } from "../interfaces/i-untrusted-text.ts";
import type { IWriteCall } from "../interfaces/i-write-call.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import type { ProgramResult } from "../models/program-result.ts";
import { ProgramRun } from "../models/program-run.ts";
import type { RepositoryFolders } from "../models/repository-folders.ts";
import { Required } from "../models/required.ts";
import { WritePermission } from "../models/write-permission.ts";
import { Resources } from "../resources.ts";
import type { HooksReader } from "./hooks.reader.ts";
import { LogReader } from "./log.reader.ts";
import { MethodFailures } from "./method-failures.ts";
import type { ProgramRunner } from "./program-runner.ts";
import type { SessionBranches } from "./session-branches.ts";

export class PushWriter implements IGitWrite {
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.writeOutputBytes, Resources.longWriteMilliseconds);
  private static readonly READ_LIMITS: ProgramLimits = new ProgramLimits(Resources.configOutputBytes, Resources.gitReadMilliseconds);
  private static readonly ONCE: readonly PermissionOption[] = [PermissionOption.AllowOnce, PermissionOption.Deny];
  private static readonly ALWAYS: readonly PermissionOption[] = [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny];
  private readonly runner: ProgramRunner;
  private readonly hooks: HooksReader;
  private readonly branches: SessionBranches;

  public constructor(runner: ProgramRunner, hooks: HooksReader, branches: SessionBranches) {
    this.runner = runner;
    this.hooks = hooks;
    this.branches = branches;
  }

  public refuse(status: GitStatus): void {
    const { tracked } = PushWriter.targetOf(status);
    if (tracked === null)
      return;
    if (tracked.behind > 0)
      throw new PushBehindException();
    if (tracked.ahead === 0)
      throw new NothingToPushException();
  }

  public async requestAsync(folders: RepositoryFolders, status: GitStatus, call: IWriteCall, signal?: AbortSignal): Promise<IPermissionRequest | null> {
    const { branch, remote, target, excluded } = PushWriter.targetOf(status);
    const [url, defaultBranch, count, commits, hooks] = await Promise.all([
      this.readAsync(new GitArguments([...Resources.pushUrlArguments, remote.name]), folders.top, signal),
      this.readDefaultBranchAsync(folders.top, remote, signal),
      this.readAsync(new GitArguments([...Resources.countCommitsArguments, ...excluded]), folders.top, signal),
      this.readAsync(new GitArguments([...Resources.pushLogArguments, Resources.headRevision, ...excluded]), folders.top, signal),
      this.hooks.readAsync(folders.top, Resources.pushHooks, signal)
    ]);
    const isDefault = target === defaultBranch;
    const isMade = target === branch && this.branches.has(call.session, folders.top, branch);
    const isAlways = isMade && defaultBranch !== null && !isDefault;
    const lines = PushWriter.linesOf(commits);
    const total = Number(count.replace(Resources.lineEndPattern, ""));
    const details: IPermissionDetail[] = [
      { label: Resources.remoteLabel, kind: PermissionDetailKind.Text, value: Resources.formatRemoteLine(remote.name, MethodFailures.stripUserinfo(url.replace(Resources.lineEndPattern, ""))) },
      { label: Resources.branchLabel, kind: PermissionDetailKind.Text, value: Resources.formatPushBranch(branch, target, isDefault, isMade) },
      { label: Resources.commitsLabel, kind: PermissionDetailKind.Code, value: [...lines, ...(total > lines.length ? [Resources.formatMoreCommits(total - lines.length)] : [])].join(Resources.lineEnd) },
      WritePermission.hooksDetail(hooks)
    ];
    if (isDefault)
      details.push({ label: Resources.noteLabel, kind: PermissionDetailKind.Text, value: Resources.defaultNeverAlways });
    return WritePermission.create(
      GitNames.pushMethod,
      JSON.stringify(isAlways ? [folders.top, remote.name, target, call.session] : [folders.top, remote.name, target]),
      Resources.formatPushTitle(total, remote.name, target),
      details,
      isAlways ? ToolRisk.Medium : ToolRisk.High,
      isAlways ? PushWriter.ALWAYS : PushWriter.ONCE);
  }

  public async runAsync(folders: RepositoryFolders, status: GitStatus, signal?: AbortSignal): Promise<void> {
    const { branch, head, remote, target } = PushWriter.targetOf(status);
    const gitArguments = new GitArguments([...Resources.pushArguments, remote.name, Resources.formatRefspec(head, target)]);
    const result = await this.runner.runAsync(ProgramRun.writeGit(gitArguments, folders.top, folders.gitFolder, folders.commonGitFolder, PushWriter.LIMITS, signal));
    if (result.exit.code !== 0)
      throw PushWriter.failureOf(result);
    if (status.upstream !== null)
      return;
    await this.configureAsync(folders, Resources.formatBranchRemoteKey(branch), remote.name, signal);
    await this.configureAsync(folders, Resources.formatBranchMergeKey(branch), Resources.formatBranchRef(target), signal);
  }

  private static targetOf(status: GitStatus):
    { branch: string; head: string; remote: GitRemote; target: string; tracked: StatusUpstream | null; excluded: string[] } {
    const { branch, head, remote, upstream } = status;
    if (branch === null)
      throw new PushDetachedException();
    if (remote === null)
      throw new PushNoRemoteException();
    if (head === null)
      throw new NothingToPushException();
    const prefix = Resources.formatRemotePrefix(remote.name);
    const onRemote = upstream !== null && upstream.name.startsWith(prefix) ? upstream : null;
    const tracked = onRemote !== null && !onRemote.gone ? onRemote : null;
    return {
      branch,
      head,
      remote,
      target: onRemote === null ? branch : onRemote.name.slice(prefix.length),
      tracked,
      excluded: tracked === null ? Resources.formatNotOnRemote(remote.name) : [Resources.formatExcludedRemoteRef(tracked.name)]
    };
  }

  private async configureAsync(folders: RepositoryFolders, key: string, value: string, signal?: AbortSignal): Promise<void> {
    const gitArguments = new GitArguments([...Resources.setConfigArguments, key, value]);
    const result = await this.runner.runAsync(ProgramRun.writeGit(gitArguments, folders.top, folders.gitFolder, folders.commonGitFolder, PushWriter.READ_LIMITS, signal));
    if (result.exit.code !== 0)
      throw new UpstreamNotSetException(PushWriter.untrusted(result.errors));
  }

  private async readDefaultBranchAsync(top: string, remote: GitRemote, signal?: AbortSignal): Promise<string | null> {
    const gitArguments = new GitArguments([...Resources.defaultBranchArguments, Resources.formatRemoteHeadRef(remote.name)]);
    const result = await this.runner.runAsync(ProgramRun.readGit(gitArguments, top, PushWriter.READ_LIMITS, signal));
    if (result.exit.code === Resources.notSymbolicExitCode)
      return null;
    if (result.exit.code !== 0)
      throw new GitFailedException(Resources.symbolicRefCommand, PushWriter.untrusted(result.errors));
    const name = result.output.toString(Resources.utf8Encoding).replace(Resources.lineEndPattern, "");
    return name.startsWith(Resources.formatRemotePrefix(remote.name)) ? name.slice(remote.name.length + 1) : null;
  }

  private async readAsync(gitArguments: GitArguments, top: string, signal?: AbortSignal): Promise<string> {
    const result = await this.runner.runAsync(ProgramRun.readGit(gitArguments, top, PushWriter.READ_LIMITS, signal));
    if (result.exit.code !== 0)
      throw new GitFailedException(Resources.formatGitCommand(gitArguments.options), PushWriter.untrusted(result.errors));
    return result.output.toString(Resources.utf8Encoding);
  }

  private static fieldAt(fields: readonly string[], index: number): string {
    return Required.at(fields, index, Resources.logCommand, Resources.commitsPart);
  }

  private static linesOf(output: string): string[] {
    const fields = output.split(Resources.recordSeparator);
    const lines: string[] = [];
    for (let index = 0; index + 1 < fields.length; index += 2)
      lines.push(Resources.formatCommitLine(PushWriter.fieldAt(fields, index), LogReader.toLine(PushWriter.fieldAt(fields, index + 1))));
    return lines;
  }

  private static failureOf(result: ProgramResult): GitFailureException {
    const output = PushWriter.untrusted(result.errors);
    if (Resources.rejectedPattern.test(result.output.toString(Resources.utf8Encoding)))
      return new PushRejectedException(output);
    if (Resources.hostKeyFailedPattern.test(output.text))
      return new HostKeyUnknownException(output);
    if (Resources.keyRefusedPattern.test(output.text))
      return new KeyRefusedException(output);
    if (Resources.credentialsPattern.test(output.text))
      return new CredentialsNeededException(output);
    return new GitFailedException(Resources.pushCommand, output);
  }

  private static untrusted(errors: Buffer): IUntrustedText {
    return { text: errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository };
  }
}
