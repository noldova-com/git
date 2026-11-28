/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IWindowPartContext, WindowException } from "@noldova/desktop.window";
import { JsonException } from "@noldova/context.json";
import {
  type ConflictResolution,
  type DiffScope,
  FailureCode,
  GitAvatar,
  GitAvatarParams,
  GitBranches,
  GitBranchAtParams,
  GitBranchParams,
  GitBranchRenameParams,
  GitChanged,
  GitCommandLog,
  GitCommitDetail,
  GitCommitSignature,
  GitCommitSigning,
  GitCommitDetailParams,
  GitCommitParams,
  GitConflict,
  GitConflictParams,
  GitDiff,
  GitDiffParams,
  GitFailure,
  GitFetchParams,
  GitStashParams,
  GitFolderParams,
  GitMarkerCheck,
  GitForcePushParams,
  GitGraph,
  GitGraphParams,
  GitHooks,
  GitRepositoryScan,
  GitJournal,
  GitLog,
  GitLogParams,
  GitOperationParams,
  GitNames,
  GitLinesParams,
  GitPathsParams,
  GitPickParams,
  GitPredictParams,
  GitPrediction,
  type PredictionAction,
  GitPullParams,
  GitRebaseCheck,
  GitRebaseCheckParams,
  GitRebaseParams,
  GitRebasePlan,
  GitRebasePlanParams,
  type RebaseStep,
  GitPushParams,
  GitResolveParams,
  GitStatus,
  GitTagAtParams,
  GitTagParams,
  GitUndoParams,
  GitRemoteTracks,
  GitUndoCommitParams,
  GitRepositoryItems, GitWorktrees,
  type JsonValue,
  ProtocolException
} from "@noldova/git.protocol";

import { Resources } from "../../resources.ts";

export class GitRuntimeClient {
  private readonly context: IWindowPartContext;

  public constructor(context: IWindowPartContext) {
    this.context = context;
  }

  public static failureOf(error: unknown): GitFailure | null {
    if (!(error instanceof Error) || !("details" in error))
      return null;
    try {
      return GitFailure.fromJson(error.details);
    }
    catch (failure) {
      if (GitRuntimeClient.isUnreadable(failure))
        return null;
      throw failure;
    }
  }

  public static isNotRepository(error: unknown): boolean {
    return GitRuntimeClient.failureOf(error)?.code === FailureCode.NotRepository;
  }

  public static isFailure(error: unknown): boolean {
    return error instanceof WindowException || GitRuntimeClient.isUnreadable(error);
  }

  public async statusAsync(folder: string): Promise<GitStatus> {
    return GitStatus.fromJson(await this.context.requestAsync(GitNames.statusMethod, new GitFolderParams(folder).toJson()));
  }

  public async branchesAsync(folder: string): Promise<GitBranches> {
    return GitBranches.fromJson(await this.context.requestAsync(GitNames.branchesMethod, new GitFolderParams(folder).toJson()));
  }

  public async commitDetailAsync(folder: string, id: string): Promise<GitCommitDetail> {
    return GitCommitDetail.fromJson(await this.context.requestAsync(GitNames.commitDetailMethod, new GitCommitDetailParams(folder, id).toJson()));
  }

  public async commitSignatureAsync(folder: string, id: string): Promise<GitCommitSignature> {
    return GitCommitSignature.fromJson(await this.context.requestAsync(GitNames.commitSignatureMethod, new GitCommitDetailParams(folder, id).toJson()));
  }

  public async commitSigningAsync(folder: string): Promise<GitCommitSigning> {
    return GitCommitSigning.fromJson(await this.context.requestAsync(GitNames.commitSigningMethod, new GitFolderParams(folder).toJson()));
  }

  public async remoteTracksAsync(folder: string): Promise<GitRemoteTracks> {
    return GitRemoteTracks.fromJson(await this.context.requestAsync(GitNames.remoteTracksMethod, new GitFolderParams(folder).toJson()));
  }

  public async repositoryItemsAsync(folder: string): Promise<GitRepositoryItems> {
    return GitRepositoryItems.fromJson(await this.context.requestAsync(GitNames.repositoryItemsMethod, new GitFolderParams(folder).toJson()));
  }

  public async scanRepositoriesAsync(folder: string): Promise<GitRepositoryScan> {
    return GitRepositoryScan.fromJson(await this.context.requestAsync(GitNames.scanRepositoriesMethod, new GitFolderParams(folder).toJson()));
  }

  public async worktreesAsync(folder: string): Promise<GitWorktrees> {
    return GitWorktrees.fromJson(await this.context.requestAsync(GitNames.worktreesMethod, new GitFolderParams(folder).toJson()));
  }

  public async graphAsync(folder: string, limit: number, skip: number): Promise<GitGraph> {
    return GitGraph.fromJson(await this.context.requestAsync(GitNames.graphMethod, new GitGraphParams(folder, limit, skip).toJson()));
  }

  public async avatarAsync(email: string): Promise<GitAvatar> {
    return GitAvatar.fromJson(await this.context.requestAsync(GitNames.avatarMethod, new GitAvatarParams(email).toJson()));
  }

  public async logAsync(folder: string, limit: number): Promise<GitLog> {
    return GitLog.fromJson(await this.context.requestAsync(GitNames.logMethod, new GitLogParams(folder, limit).toJson()));
  }

  public async pullHooksAsync(folder: string): Promise<GitHooks> {
    return GitHooks.fromJson(await this.context.requestAsync(GitNames.pullHooksMethod, new GitFolderParams(folder).toJson()));
  }

  public async diffAsync(folder: string, scope: DiffScope): Promise<GitDiff> {
    return GitDiff.fromJson(await this.context.requestAsync(GitNames.diffMethod, new GitDiffParams(folder, scope).toJson()));
  }

  public async stageAsync(folder: string, paths: readonly string[], basedOn: string): Promise<void> {
    await this.context.requestAsync(GitNames.stageMethod, new GitPathsParams(folder, paths, basedOn).toJson());
  }

  public async unstageAsync(folder: string, paths: readonly string[], basedOn: string): Promise<void> {
    await this.context.requestAsync(GitNames.unstageMethod, new GitPathsParams(folder, paths, basedOn).toJson());
  }

  public async discardAsync(folder: string, paths: readonly string[], basedOn: string): Promise<void> {
    await this.context.requestAsync(GitNames.discardMethod, new GitPathsParams(folder, paths, basedOn).toJson());
  }

  public async predictAsync(folder: string, id: string, action: PredictionAction): Promise<GitPrediction> {
    return GitPrediction.fromJson(await this.context.requestAsync(GitNames.predictMethod, new GitPredictParams(folder, id, action).toJson()));
  }

  public async rebasePlanAsync(folder: string, onto: string): Promise<GitRebasePlan> {
    return GitRebasePlan.fromJson(await this.context.requestAsync(GitNames.rebasePlanMethod, new GitRebasePlanParams(folder, onto).toJson()));
  }

  public async rebaseCheckAsync(folder: string, onto: string, steps: readonly RebaseStep[]): Promise<GitRebaseCheck> {
    return GitRebaseCheck.fromJson(await this.context.requestAsync(GitNames.rebaseCheckMethod, new GitRebaseCheckParams(folder, onto, steps).toJson()));
  }

  public async rebaseAsync(folder: string, onto: string, steps: readonly RebaseStep[], updateRefs: boolean, basedOn: string): Promise<void> {
    await this.context.requestAsync(GitNames.rebaseMethod, new GitRebaseParams(folder, onto, steps, updateRefs, basedOn).toJson());
  }

  public async commandLogAsync(folder: string): Promise<GitCommandLog> {
    return GitCommandLog.fromJson(await this.context.requestAsync(GitNames.commandLogMethod, new GitFolderParams(folder).toJson()));
  }

  public async journalAsync(folder: string): Promise<GitJournal> {
    return GitJournal.fromJson(await this.context.requestAsync(GitNames.journalMethod, new GitFolderParams(folder).toJson()));
  }

  public async undoAsync(folder: string, id: string, basedOn: string): Promise<void> {
    await this.context.requestAsync(GitNames.undoMethod, new GitUndoParams(folder, id, basedOn).toJson());
  }

  public async stageLinesAsync(folder: string, path: string, lines: readonly number[], basedOn: string): Promise<void> {
    await this.context.requestAsync(GitNames.stageLinesMethod, new GitLinesParams(folder, path, lines, basedOn).toJson());
  }

  public async unstageLinesAsync(folder: string, path: string, lines: readonly number[], basedOn: string): Promise<void> {
    await this.context.requestAsync(GitNames.unstageLinesMethod, new GitLinesParams(folder, path, lines, basedOn).toJson());
  }

  public async createBranchAsync(folder: string, name: string, basedOn: string): Promise<void> {
    await this.context.requestAsync(GitNames.createBranchMethod, new GitBranchParams(folder, name, basedOn).toJson());
  }

  public async switchBranchAsync(folder: string, name: string, basedOn: string): Promise<void> {
    await this.context.requestAsync(GitNames.switchBranchMethod, new GitBranchParams(folder, name, basedOn).toJson());
  }

  public async commitAsync(folder: string, message: string, basedOn: string): Promise<void> {
    await this.context.requestAsync(GitNames.commitMethod, new GitCommitParams(folder, message, basedOn).toJson());
  }

  public async amendAsync(folder: string, message: string, basedOn: string): Promise<void> {
    await this.context.requestAsync(GitNames.amendMethod, new GitCommitParams(folder, message, basedOn).toJson());
  }

  public async pushAsync(folder: string, basedOn: string): Promise<void> {
    await this.context.requestAsync(GitNames.pushMethod, new GitPushParams(folder, basedOn).toJson());
  }

  public async undoCommitAsync(folder: string, basedOn: string): Promise<void> {
    await this.context.requestAsync(GitNames.undoCommitMethod, new GitUndoCommitParams(folder, basedOn).toJson());
  }

  public async forcePushAsync(folder: string, expected: string, basedOn: string): Promise<void> {
    await this.context.requestAsync(GitNames.forcePushMethod, new GitForcePushParams(folder, expected, basedOn).toJson());
  }

  public async stashAsync(folder: string, message: string | null, includeUntracked: boolean, basedOn: string): Promise<void> {
    await this.context.requestAsync(GitNames.stashMethod, new GitStashParams(folder, message, includeUntracked, basedOn).toJson());
  }

  public async fetchAsync(folder: string, basedOn: string, allRemotes: boolean = false): Promise<void> {
    await this.context.requestAsync(GitNames.fetchMethod, new GitFetchParams(folder, basedOn, allRemotes).toJson());
  }

  public async pullAsync(folder: string, basedOn: string): Promise<void> {
    await this.context.requestAsync(GitNames.pullMethod, new GitPullParams(folder, basedOn).toJson());
  }

  public async createBranchAtAsync(folder: string, name: string, id: string, basedOn: string): Promise<void> {
    await this.context.requestAsync(GitNames.createBranchAtMethod, new GitBranchAtParams(folder, name, id, basedOn).toJson());
  }

  public async renameBranchAsync(folder: string, name: string, newName: string, basedOn: string): Promise<void> {
    await this.context.requestAsync(GitNames.renameBranchMethod, new GitBranchRenameParams(folder, name, newName, basedOn).toJson());
  }

  public async deleteBranchAsync(folder: string, name: string, basedOn: string): Promise<void> {
    await this.context.requestAsync(GitNames.deleteBranchMethod, new GitBranchParams(folder, name, basedOn).toJson());
  }

  public async createTagAsync(folder: string, name: string, id: string, basedOn: string): Promise<void> {
    await this.context.requestAsync(GitNames.createTagMethod, new GitTagAtParams(folder, name, id, basedOn).toJson());
  }

  public async deleteTagAsync(folder: string, name: string, basedOn: string): Promise<void> {
    await this.context.requestAsync(GitNames.deleteTagMethod, new GitTagParams(folder, name, basedOn).toJson());
  }

  public async cherryPickAsync(folder: string, id: string, basedOn: string): Promise<void> {
    await this.context.requestAsync(GitNames.cherryPickMethod, new GitPickParams(folder, id, basedOn).toJson());
  }

  public async mergeAsync(folder: string, id: string, basedOn: string): Promise<void> {
    await this.context.requestAsync(GitNames.mergeMethod, new GitPickParams(folder, id, basedOn).toJson());
  }

  public async revertAsync(folder: string, id: string, basedOn: string): Promise<void> {
    await this.context.requestAsync(GitNames.revertMethod, new GitPickParams(folder, id, basedOn).toJson());
  }

  public async conflictAsync(folder: string, path: string): Promise<GitConflict> {
    return GitConflict.fromJson(await this.context.requestAsync(GitNames.conflictMethod, new GitConflictParams(folder, path).toJson()));
  }

  public async markerCheckAsync(folder: string): Promise<GitMarkerCheck> {
    return GitMarkerCheck.fromJson(await this.context.requestAsync(GitNames.markerCheckMethod, new GitFolderParams(folder).toJson()));
  }

  public async resolveConflictAsync(folder: string, path: string, resolution: ConflictResolution, text: string | null, basedOn: string): Promise<void> {
    await this.context.requestAsync(GitNames.resolveConflictMethod, new GitResolveParams(folder, path, resolution, text, basedOn).toJson());
  }

  public async continueOperationAsync(folder: string, basedOn: string): Promise<void> {
    await this.context.requestAsync(GitNames.continueOperationMethod, new GitOperationParams(folder, basedOn).toJson());
  }

  public async abortOperationAsync(folder: string, basedOn: string): Promise<void> {
    await this.context.requestAsync(GitNames.abortOperationMethod, new GitOperationParams(folder, basedOn).toJson());
  }

  public async skipOperationAsync(folder: string, basedOn: string): Promise<void> {
    await this.context.requestAsync(GitNames.skipOperationMethod, new GitOperationParams(folder, basedOn).toJson());
  }

  public async watchAsync(folder: string): Promise<void> {
    await this.context.requestAsync(GitNames.watchMethod, new GitFolderParams(folder).toJson());
  }

  public async unwatchAsync(folder: string): Promise<void> {
    await this.context.requestAsync(GitNames.unwatchMethod, new GitFolderParams(folder).toJson());
  }

  public onChanged(listener: (folder: string) => void): () => void {
    return this.context.onEvent(GitNames.changedEvent, (payload: JsonValue) => {
      let folder: string;
      try {
        folder = GitChanged.fromJson(payload).folder;
      }
      catch (error) {
        if (!GitRuntimeClient.isUnreadable(error))
          throw error;
        this.context.log(Resources.formatChangedRefused(String(error)));
        return;
      }
      listener(folder);
    });
  }

  private static isUnreadable(error: unknown): boolean {
    return error instanceof JsonException || error instanceof ProtocolException;
  }
}
