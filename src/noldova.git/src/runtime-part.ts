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
  GitAvatar,
  GitAvatarParams,
  GitBranchAtParams,
  GitBranchParams,
  GitBranchRenameParams,
  GitChanged,
  GitCommitParams,
  GitConflictParams,
  GitDiffParams,
  GitCommitDetailParams,
  GitFetchParams,
  GitStashParams,
  GitFolderParams,
  GitForcePushParams,
  GitHooks,
  GitGraphParams,
  GitLogParams,
  GitMessageReferencesParams,
  GitNames,
  GitOperationParams,
  GitPathsParams,
  GitPickParams,
  GitPullParams,
  GitPushParams,
  GitLinesParams,
  GitTagAtParams,
  GitTagParams,
  GitResetParams,
  GitUndoCommitParams,
  GitUndoParams,
  ResetMode,
  GitResolveParams,
  GitPredictParams,
  GitRebaseCheckParams,
  GitRebaseParams,
  GitRebasePlanParams,
  type JsonValue
} from "@noldova/git.protocol";

import { BranchExistsException } from "./exceptions/branch-exists.exception.ts";
import { TagExistsException } from "./exceptions/tag-exists.exception.ts";
import type { IFolderParams } from "./interfaces/i-folder-params.ts";
import type { IGitWrite } from "./interfaces/i-git-write.ts";
import type { IJsonAnswer } from "./interfaces/i-json-answer.ts";
import type { IWriteParams } from "./interfaces/i-write-params.ts";
import type { RepositoryFolders } from "./models/repository-folders.ts";
import { Resources } from "./resources.ts";
import { BranchAtWriter } from "./services/branch-at.writer.ts";
import { BranchCreateWriter } from "./services/branch-create.writer.ts";
import { BranchSwitchWriter } from "./services/branch-switch.writer.ts";
import { BranchesReader } from "./services/branches.reader.ts";
import { ChangeMonitor } from "./services/change-monitor.ts";
import { CheckoutRisksReader } from "./services/checkout-risks.reader.ts";
import { CommitWriter } from "./services/commit.writer.ts";
import { DiffReader } from "./services/diff.reader.ts";
import { CheckpointStore } from "./services/checkpoint-store.ts";
import { DiscardWriter } from "./services/discard.writer.ts";
import { FetchWriter } from "./services/fetch.writer.ts";
import { StashWriter } from "./services/stash.writer.ts";
import { FilterOptionsReader } from "./services/filter-options.reader.ts";
import { GitVersionReader } from "./services/git-version.reader.ts";
import { GravatarReader } from "./services/gravatar.reader.ts";
import { HooksReader } from "./services/hooks.reader.ts";
import { KeyQueue } from "./services/key-queue.ts";
import { GraphReader } from "./services/graph.reader.ts";
import { LogReader } from "./services/log.reader.ts";
import { MethodFailures } from "./services/method-failures.ts";
import { ProgramRunner } from "./services/program-runner.ts";
import { PickWriter } from "./services/pick.writer.ts";
import { PredictionReader } from "./services/prediction.reader.ts";
import { RebaseCheckReader } from "./services/rebase-check.reader.ts";
import { RebaseWriter } from "./services/rebase.writer.ts";
import { RebasePlanReader } from "./services/rebase-plan.reader.ts";
import { PullWriter } from "./services/pull.writer.ts";
import { PushWriter } from "./services/push.writer.ts";
import { LinesWriter } from "./services/lines.writer.ts";
import { RefWriter } from "./services/ref.writer.ts";
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
import { SharedReads } from "./services/shared-reads.ts";
import { CommitDetailReader } from "./services/commit-detail.reader.ts";
import { CommitSignatureReader } from "./services/commit-signature.reader.ts";
import { CommitSigningReader } from "./services/commit-signing.reader.ts";
import { RepositoryItemsReader } from "./services/repository-items.reader.ts";
import { RepositoryScanReader } from "./services/repository-scan.reader.ts";
import { WorktreesReader } from "./services/worktrees.reader.ts";
import { WriteRunner } from "./services/write.runner.ts";
import { CommandLog } from "./services/command-log.ts";
import { ConflictReader } from "./services/conflict.reader.ts";
import { MarkerCheckReader } from "./services/marker-check.reader.ts";
import { MessageReferenceReader } from "./services/message-reference.reader.ts";
import { OperationWriter } from "./services/operation.writer.ts";
import { ResolveConflictWriter } from "./services/resolve-conflict.writer.ts";
import { GitTools } from "./tools/git-tools.ts";
import { Journal } from "./services/journal.ts";
import { RefSnapshotReader } from "./services/ref-snapshot.reader.ts";
import { ResetWriter } from "./services/reset.writer.ts";
import { UndoWriter } from "./services/undo.writer.ts";

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
    const commands = new CommandLog();
    const runner = new ProgramRunner(context, commands);
    const versions = new GitVersionReader(runner);
    const repositories = new RepositoryReader(runner, versions);
    const statuses = new StatusReader(runner);
    const diffs = new DiffReader(runner);
    const branches = new BranchesReader(runner, versions);
    const logs = new LogReader(runner);
    const graphs = new GraphReader(runner);
    const messageReferences = new MessageReferenceReader(runner);
    const worktrees = new WorktreesReader(runner);
    const items = new RepositoryItemsReader(runner);
    const details = new CommitDetailReader(runner);
    const signatures = new CommitSignatureReader(runner);
    const signings = new CommitSigningReader(runner);
    const hooks = new HooksReader(runner);
    const conflicts = new ConflictReader(runner);
    const markerChecks = new MarkerCheckReader(runner);
    const scans = new RepositoryScanReader(repositories);
    await new WorktreeService(context, runner).reconcileAsync();
    const changed = context.declareEvent(GitNames.changedEvent);
    const watches = new WatchTable();
    const monitor = new ChangeMonitor(runner, context.log, top => {
      for (const watch of watches.watchesOf(top))
        changed.publishTo(watch.connection, watch.window, new GitChanged(watch.folder).toJson());
    }, Resources.treeWatchOf(process.platform));
    this.monitor = monitor;
    const sharedReads = new SharedReads<IJsonAnswer>(this.reads);
    const register = <T extends IFolderParams>(
      name: string,
      parse: (payload: unknown) => T,
      read: (folders: RepositoryFolders, params: T, signal: AbortSignal) => Promise<IJsonAnswer>): void =>
      context.registerMethod(name, {
        handleAsync: request => RuntimePart.answerAsync(async () => {
          const params = parse(request.payload);
          const folders = await repositories.readAsync(params.folder);
          const lane = name === GitNames.statusMethod ? folders.top : `${folders.top}\u0000${name}`;
          return (await sharedReads.runAsync(lane, `${name}\u0000${JSON.stringify(request.payload)}`, request.signal,
            signal => read(folders, params, signal))).toJson();
        })
      });
    register(GitNames.statusMethod, t => GitFolderParams.fromJson(t), async (folders, _params, signal) => {
      const generation = monitor.generationOf(folders.top);
      const status = await statuses.readAsync(folders, signal);
      monitor.observe(folders.top, generation, status.fingerprint);
      return status;
    });
    register(GitNames.diffMethod, t => GitDiffParams.fromJson(t), (folders, params, signal) => diffs.readAsync(folders.top, params.scope, [], signal));
    register(GitNames.diffTotalsMethod, t => GitDiffParams.fromJson(t), (folders, params, signal) => diffs.countAsync(folders.top, params.scope, signal));
    register(GitNames.branchesMethod, t => GitFolderParams.fromJson(t), (folders, _params, signal) => branches.readAsync(folders.top, signal));
    register(GitNames.mergedBranchesMethod, t => GitFolderParams.fromJson(t), (folders, _params, signal) => branches.readMergedAsync(folders.top, signal));
    register(GitNames.remoteTracksMethod, t => GitFolderParams.fromJson(t), (folders, _params, signal) => branches.readRemoteTracksAsync(folders.top, signal));
    register(GitNames.logMethod, t => GitLogParams.fromJson(t), (folders, params, signal) => logs.readAsync(folders.top, params.limit, signal));
    register(GitNames.graphMethod, t => GitGraphParams.fromJson(t), (folders, params, signal) => graphs.readAsync(folders.top, params.limit, params.skip, signal));
    register(GitNames.messageReferencesMethod, t => GitMessageReferencesParams.fromJson(t),
      (folders, params, signal) => messageReferences.readAsync(folders.top, params.limit, signal));
    register(GitNames.worktreesMethod, t => GitFolderParams.fromJson(t), (folders, _params, signal) => worktrees.readAsync(folders.top, signal));
    register(GitNames.repositoryItemsMethod, t => GitFolderParams.fromJson(t), (folders, _params, signal) => items.readAsync(folders.top, signal));
    register(GitNames.commitDetailMethod, t => GitCommitDetailParams.fromJson(t), (folders, params, signal) => details.readAsync(folders.top, params.id, signal));
    register(GitNames.commitSignatureMethod, t => GitCommitDetailParams.fromJson(t), (folders, params, signal) => signatures.readAsync(folders.top, params.id, signal));
    register(GitNames.commitSigningMethod, t => GitFolderParams.fromJson(t), (folders, _params, signal) => signings.readAsync(folders.top, signal));
    register(GitNames.pullHooksMethod, t => GitFolderParams.fromJson(t),
      async (folders, _params, signal) => new GitHooks(await hooks.readKnownAsync(folders.top, Resources.pullHooks, signal)));
    const gravatars = new GravatarReader((url, init) => fetch(url, init), context.log);
    context.registerMethod(GitNames.avatarMethod, {
      handleAsync: request => RuntimePart.answerAsync(async () => {
        const params = GitAvatarParams.fromJson(request.payload);
        return new GitAvatar(context.settings.read(Resources.gravatarSetting) === false ? null : await gravatars.readAsync(params.email, request.signal)).toJson();
      })
    });
    context.registerMethod(GitNames.scanRepositoriesMethod, {
      handleAsync: request => RuntimePart.answerAsync(async () => (await scans.readAsync(GitFolderParams.fromJson(request.payload).folder, request.signal)).toJson())
    });
    register(GitNames.conflictMethod, t => GitConflictParams.fromJson(t), (folders, params, signal) => conflicts.readAsync(folders, params.path, signal));
    register(GitNames.markerCheckMethod, t => GitFolderParams.fromJson(t), (folders, _params, signal) => markerChecks.readAsync(folders.top, signal));
    context.publishService(GitNames.repositoriesService, new RepositoryStatuses(repositories, statuses, new RemoteReader(runner), this.reads));
    context.registerMethod(GitNames.watchMethod, {
      handleAsync: request => RuntimePart.answerAsync(async () => {
        const params = GitFolderParams.fromJson(request.payload);
        const watch = watches.begin(request.connection, request.window, params.folder);
        let folders: RepositoryFolders;
        let isReftable: boolean;
        try {
          folders = await repositories.readAsync(params.folder);
          isReftable = await repositories.isReftableAsync(folders, request.signal);
        } catch (error) {
          watches.abandon(watch);
          throw error;
        }
        if (watches.complete(watch, folders.top)) {
          monitor.watch(folders.top, folders.top, folders, isReftable);
          monitor.setVisible(folders.top, true);
        }
        try {
          await monitor.startedAsync(folders.top);
        } catch (error) {
          watches.drop(folders.top);
          monitor.unwatch(folders.top);
          throw error;
        }
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
    const snapshots = new RefSnapshotReader(runner);
    const journal = new Journal(() => new Date(), () => context.settings.read(Resources.undoHistorySetting));
    const checkpoints = new CheckpointStore(() => context.findService(Resources.checkpointsService, CheckpointStore.isCheckpoints));
    register(GitNames.journalMethod, t => GitFolderParams.fromJson(t), async folders => journal.read(folders.commonGitFolder, checkpoints.isAvailable));
    register(GitNames.commandLogMethod, t => GitFolderParams.fromJson(t), async folders => commands.read(folders.commonGitFolder));
    const writes = new WriteRunner(statuses, snapshots, journal, top => monitor.notifyWriting(top), top => monitor.notifyWritten(top));
    const filters = new FilterOptionsReader(runner);
    const risks = new CheckoutRisksReader(hooks, filters);
    const registerWrite = <T extends IWriteParams>(
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
    registerWrite(GitNames.discardMethod, t => GitPathsParams.fromJson(t), t => new DiscardWriter(runner, t.paths, checkpoints));
    registerWrite(GitNames.createBranchMethod, t => GitBranchParams.fromJson(t), t => new BranchCreateWriter(runner, hooks, t.name, this.branches, null));
    registerWrite(GitNames.switchBranchMethod, t => GitBranchParams.fromJson(t), t => new BranchSwitchWriter(runner, risks, t.name));
    registerWrite(GitNames.commitMethod, t => GitCommitParams.fromJson(t), t => new CommitWriter(runner, hooks, t.message));
    registerWrite(GitNames.amendMethod, t => GitCommitParams.fromJson(t), t => new CommitWriter(runner, hooks, t.message, true));
    registerWrite(GitNames.pushMethod, t => GitPushParams.fromJson(t), () => new PushWriter(runner, hooks, this.branches));
    registerWrite(GitNames.pullMethod, t => GitPullParams.fromJson(t), () => new PullWriter(runner, risks));
    registerWrite(GitNames.cherryPickMethod, t => GitPickParams.fromJson(t), t => new PickWriter(runner, hooks, GitNames.cherryPickMethod, t.id));
    registerWrite(GitNames.createBranchAtMethod, t => GitBranchAtParams.fromJson(t), t => new BranchAtWriter(runner, t.name, t.id));
    registerWrite(GitNames.renameBranchMethod, t => GitBranchRenameParams.fromJson(t),
      t => new RefWriter(runner, GitNames.renameBranchMethod, [...Resources.renameBranchArguments, t.name, t.newName], Resources.branchCommand, new BranchExistsException(t.newName)));
    registerWrite(GitNames.deleteBranchMethod, t => GitBranchParams.fromJson(t), t => new RefWriter(runner, GitNames.deleteBranchMethod, [...Resources.deleteBranchArguments, t.name], Resources.branchCommand, null));
    registerWrite(GitNames.createTagMethod, t => GitTagAtParams.fromJson(t),
      t => new RefWriter(runner, GitNames.createTagMethod, [...Resources.createTagArguments, Resources.formatTagRef(t.name), t.id, Resources.noOldValue], Resources.updateRefCommand,
        new TagExistsException(t.name)));
    registerWrite(GitNames.deleteTagMethod, t => GitTagParams.fromJson(t),
      t => new RefWriter(runner, GitNames.deleteTagMethod, [...Resources.deleteTagArguments, Resources.formatTagRef(t.name)], Resources.updateRefCommand, null));
    registerWrite(GitNames.stageLinesMethod, t => GitLinesParams.fromJson(t), t => new LinesWriter(runner, filters, t.path, t.lines, false));
    registerWrite(GitNames.unstageLinesMethod, t => GitLinesParams.fromJson(t), t => new LinesWriter(runner, filters, t.path, t.lines, true));
    registerWrite(GitNames.revertMethod, t => GitPickParams.fromJson(t), t => new PickWriter(runner, hooks, GitNames.revertMethod, t.id));
    registerWrite(GitNames.undoMethod, t => GitUndoParams.fromJson(t), t => new UndoWriter(runner, snapshots, journal, checkpoints, t.id));
    registerWrite(GitNames.resetMethod, t => GitResetParams.fromJson(t), t => new ResetWriter(runner, t.mode, t.id));
    registerWrite(GitNames.undoCommitMethod, t => GitUndoCommitParams.fromJson(t), () => new ResetWriter(runner, ResetMode.Soft, null));
    registerWrite(GitNames.forcePushMethod, t => GitForcePushParams.fromJson(t), t => new PushWriter(runner, hooks, this.branches, t.expected));
    registerWrite(GitNames.resolveConflictMethod, t => GitResolveParams.fromJson(t),
      t => new ResolveConflictWriter(runner, hooks, filters, t.path, t.resolution, t.text));
    registerWrite(GitNames.continueOperationMethod, t => GitOperationParams.fromJson(t), () => new OperationWriter(runner, hooks, GitNames.continueOperationMethod));
    registerWrite(GitNames.abortOperationMethod, t => GitOperationParams.fromJson(t), () => new OperationWriter(runner, hooks, GitNames.abortOperationMethod));
    registerWrite(GitNames.skipOperationMethod, t => GitOperationParams.fromJson(t), () => new OperationWriter(runner, hooks, GitNames.skipOperationMethod));
    const predictions = new PredictionReader(runner, versions, filters);
    register(GitNames.predictMethod, t => GitPredictParams.fromJson(t), (folders, params, signal) => predictions.readAsync(folders.top, params.id, params.action, signal));
    const rebasePlans = new RebasePlanReader(runner);
    register(GitNames.rebasePlanMethod, t => GitRebasePlanParams.fromJson(t), (folders, params, signal) => rebasePlans.readAsync(folders.top, params.onto, signal));
    const rebaseChecks = new RebaseCheckReader(runner, versions, filters);
    register(GitNames.rebaseCheckMethod, t => GitRebaseCheckParams.fromJson(t), (folders, params, signal) => rebaseChecks.readAsync(folders.top, params.onto, params.steps, signal));
    registerWrite(GitNames.mergeMethod, t => GitPickParams.fromJson(t), t => new PickWriter(runner, hooks, GitNames.mergeMethod, t.id));
    registerWrite(GitNames.rebaseMethod, t => GitRebaseParams.fromJson(t), t => new RebaseWriter(runner, hooks, t.onto, t.steps, t.updateRefs));
    registerWrite(GitNames.fetchMethod, t => GitFetchParams.fromJson(t), t => new FetchWriter(runner, t.allRemotes));
    registerWrite(GitNames.stashMethod, t => GitStashParams.fromJson(t), t => new StashWriter(runner, t.message, t.includeUntracked));
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
