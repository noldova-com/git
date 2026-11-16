/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { Failure, FailureCode as DesktopCode, ShellClients } from "@noldova/desktop.protocol";
import { type IRuntimePart, type IRuntimePartContext, MethodFailureException, type Migration } from "@noldova/desktop.runtime";
import {
  GitBranchParams,
  GitChanged,
  GitCommitParams,
  GitDiffParams,
  GitFolderParams,
  GitHooks,
  GitLogParams,
  GitNames,
  GitPathsParams,
  GitPullParams,
  GitPushParams,
  type JsonObject,
  type JsonValue
} from "@noldova/git.protocol";

import type { IGitWrite } from "./interfaces/i-git-write.ts";
import type { RepositoryFolders } from "./models/repository-folders.ts";
import { Resources } from "./resources.ts";
import { BranchCreateWriter } from "./services/branch-create.writer.ts";
import { BranchSwitchWriter } from "./services/branch-switch.writer.ts";
import { BranchesReader } from "./services/branches.reader.ts";
import { ChangeMonitor } from "./services/change-monitor.ts";
import { CheckoutRisksReader } from "./services/checkout-risks.reader.ts";
import { CommitWriter } from "./services/commit.writer.ts";
import { DiffReader } from "./services/diff.reader.ts";
import { FilterOptionsReader } from "./services/filter-options.reader.ts";
import { GitVersionReader } from "./services/git-version.reader.ts";
import { HooksReader } from "./services/hooks.reader.ts";
import { KeyQueue } from "./services/key-queue.ts";
import { LogReader } from "./services/log.reader.ts";
import { MethodFailures } from "./services/method-failures.ts";
import { ProgramRunner } from "./services/program-runner.ts";
import { PullWriter } from "./services/pull.writer.ts";
import { PushWriter } from "./services/push.writer.ts";
import { RepositoryReader } from "./services/repository.reader.ts";
import { RemoteReader } from "./services/remote.reader.ts";
import { RepositoryStatuses } from "./services/repository-statuses.ts";
import { SessionBranches } from "./services/session-branches.ts";
import { StageWriter } from "./services/stage.writer.ts";
import { StatusReader } from "./services/status.reader.ts";
import { UnstageWriter } from "./services/unstage.writer.ts";
import { WatchTable } from "./services/watch-table.ts";
import { WorktreeTable } from "./services/worktree-table.ts";
import { WorktreeService } from "./services/worktree.service.ts";
import { WorktreesReader } from "./services/worktrees.reader.ts";
import { WriteRunner } from "./services/write.runner.ts";
import { GitTools } from "./tools/git-tools.ts";

export class RuntimePart implements IRuntimePart {
  private context: IRuntimePartContext | null = null;
  private readonly reads: KeyQueue = new KeyQueue();
  private monitor: ChangeMonitor | null = null;
  private readonly branches: SessionBranches = new SessionBranches();
  private tools: GitTools | null = null;

  public readonly migrations: readonly Migration[] = [WorktreeTable.migration];

  public get isActive(): boolean {
    return this.context !== null;
  }

  public async activateAsync(context: IRuntimePartContext): Promise<void> {
    try {
      await this.startAsync(context);
    } catch (error) {
      await this.deactivateAsync();
      throw error;
    }
    this.context = context;
  }

  public async deactivateAsync(): Promise<void> {
    this.tools?.dispose();
    this.tools = null;
    await this.monitor?.disposeAsync();
    this.monitor = null;
    this.context = null;
  }

  private async startAsync(context: IRuntimePartContext): Promise<void> {
    const runner = new ProgramRunner(context);
    const repositories = new RepositoryReader(runner, new GitVersionReader(runner));
    const statuses = new StatusReader(runner);
    const diffs = new DiffReader(runner);
    const branches = new BranchesReader(runner);
    const logs = new LogReader(runner);
    const worktrees = new WorktreesReader(runner);
    const hooks = new HooksReader(runner);
    await new WorktreeService(context, runner).reconcileAsync();
    const register = <T extends { readonly folder: string }>(
      name: string,
      parse: (payload: unknown) => T,
      read: (folders: RepositoryFolders, params: T, signal: AbortSignal) => Promise<{ toJson(): JsonObject }>): void =>
      context.registerMethod(name, {
        handleAsync: request => RuntimePart.answerAsync(async () => {
          const params = parse(request.payload);
          const folders = await repositories.readAsync(params.folder);
          return (await this.reads.runAsync(folders.top, () => read(folders, params, request.signal))).toJson();
        })
      });
    register(GitNames.statusMethod, t => GitFolderParams.fromJson(t), (folders, _params, signal) => statuses.readAsync(folders, signal));
    register(GitNames.diffMethod, t => GitDiffParams.fromJson(t), (folders, params, signal) => diffs.readAsync(folders.top, params.scope, [], signal));
    register(GitNames.branchesMethod, t => GitFolderParams.fromJson(t), (folders, _params, signal) => branches.readAsync(folders.top, signal));
    register(GitNames.logMethod, t => GitLogParams.fromJson(t), (folders, params, signal) => logs.readAsync(folders.top, params.limit, signal));
    register(GitNames.worktreesMethod, t => GitFolderParams.fromJson(t), (folders, _params, signal) => worktrees.readAsync(folders.top, signal));
    register(GitNames.pullHooksMethod, t => GitFolderParams.fromJson(t),
      async (folders, _params, signal) => new GitHooks(await hooks.readKnownAsync(folders.top, Resources.pullHooks, signal)));
    context.publishService(GitNames.repositoriesService, new RepositoryStatuses(repositories, statuses, new RemoteReader(runner), this.reads));
    const changed = context.declareEvent(GitNames.changedEvent);
    const watches = new WatchTable();
    const monitor = new ChangeMonitor(runner, context.log, top => {
      for (const watch of watches.watchesOf(top))
        changed.publishTo(watch.connection, watch.window, new GitChanged(watch.folder).toJson());
    });
    this.monitor = monitor;
    context.registerMethod(GitNames.watchMethod, {
      handleAsync: request => RuntimePart.answerAsync(async () => {
        const params = GitFolderParams.fromJson(request.payload);
        const watch = watches.begin(request.connection, request.window, params.folder);
        let folders: RepositoryFolders;
        try {
          folders = await repositories.readAsync(params.folder);
        } catch (error) {
          watches.abandon(watch);
          throw error;
        }
        if (watches.complete(watch, folders.top)) {
          monitor.watch(folders.top, folders.top, folders);
          monitor.setVisible(folders.top, true);
        }
        await monitor.startedAsync(folders.top);
        return null;
      })
    });
    context.registerMethod(GitNames.unwatchMethod, {
      handleAsync: request => RuntimePart.answerAsync(async () => {
        const params = GitFolderParams.fromJson(request.payload);
        const top = watches.remove(request.connection, request.window, params.folder);
        if (top !== null)
          monitor.unwatch(top);
        return null;
      })
    });
    context.onClientClosed(closure => {
      for (const top of watches.removeClient(closure.connection, closure.window))
        monitor.unwatch(top);
    });
    const writes = new WriteRunner(statuses, top => monitor.notifyWritten(top));
    const filters = new FilterOptionsReader(runner);
    const risks = new CheckoutRisksReader(hooks, filters);
    const registerWrite = <T extends { readonly folder: string; readonly basedOn: string }>(
      name: string,
      parse: (payload: unknown) => T,
      write: (params: T) => IGitWrite): void =>
      context.registerMethod(name, {
        handleAsync: request => RuntimePart.answerAsync(async () => {
          if (request.client !== ShellClients.mainProcess || request.window === null)
            throw new MethodFailureException(new Failure(DesktopCode.Unauthorized, Resources.mainProcessOnly));
          const params = parse(request.payload);
          await writes.runAsync(await repositories.readAsync(params.folder), params.basedOn, write(params), null, request.signal);
          return null;
        })
      });
    registerWrite(GitNames.stageMethod, t => GitPathsParams.fromJson(t), t => new StageWriter(runner, hooks, filters, t.paths));
    registerWrite(GitNames.unstageMethod, t => GitPathsParams.fromJson(t), t => new UnstageWriter(runner, hooks, t.paths));
    registerWrite(GitNames.createBranchMethod, t => GitBranchParams.fromJson(t), t => new BranchCreateWriter(runner, hooks, t.name, this.branches, null));
    registerWrite(GitNames.switchBranchMethod, t => GitBranchParams.fromJson(t), t => new BranchSwitchWriter(runner, risks, t.name));
    registerWrite(GitNames.commitMethod, t => GitCommitParams.fromJson(t), t => new CommitWriter(runner, hooks, t.message));
    registerWrite(GitNames.pushMethod, t => GitPushParams.fromJson(t), () => new PushWriter(runner, hooks, this.branches));
    registerWrite(GitNames.pullMethod, t => GitPullParams.fromJson(t), () => new PullWriter(runner, risks));
    const tools = new GitTools({
      runner, repositories, statuses, diffs, logs, branchesReader: branches, hooks, filters, reads: this.reads, writes, sessionBranches: this.branches
    });
    this.tools = tools;
    tools.publish(context.tools);
  }

  private static async answerAsync(read: () => Promise<JsonValue>): Promise<JsonValue> {
    try {
      return await read();
    } catch (error) {
      throw MethodFailures.toMethodFailure(error);
    }
  }
}
