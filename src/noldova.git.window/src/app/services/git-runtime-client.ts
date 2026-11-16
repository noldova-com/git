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
  type DiffScope,
  GitBranches,
  GitBranchParams,
  GitChanged,
  GitCommitParams,
  GitDiff,
  GitDiffParams,
  GitFailure,
  GitFolderParams,
  GitHooks,
  GitNames,
  GitPathsParams,
  GitPullParams,
  GitPushParams,
  GitStatus,
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

  public static isFailure(error: unknown): boolean {
    return error instanceof WindowException || GitRuntimeClient.isUnreadable(error);
  }

  public async statusAsync(folder: string): Promise<GitStatus> {
    return GitStatus.fromJson(await this.context.requestAsync(GitNames.statusMethod, new GitFolderParams(folder).toJson()));
  }

  public async branchesAsync(folder: string): Promise<GitBranches> {
    return GitBranches.fromJson(await this.context.requestAsync(GitNames.branchesMethod, new GitFolderParams(folder).toJson()));
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

  public async createBranchAsync(folder: string, name: string, basedOn: string): Promise<void> {
    await this.context.requestAsync(GitNames.createBranchMethod, new GitBranchParams(folder, name, basedOn).toJson());
  }

  public async switchBranchAsync(folder: string, name: string, basedOn: string): Promise<void> {
    await this.context.requestAsync(GitNames.switchBranchMethod, new GitBranchParams(folder, name, basedOn).toJson());
  }

  public async commitAsync(folder: string, message: string, basedOn: string): Promise<void> {
    await this.context.requestAsync(GitNames.commitMethod, new GitCommitParams(folder, message, basedOn).toJson());
  }

  public async pushAsync(folder: string, basedOn: string): Promise<void> {
    await this.context.requestAsync(GitNames.pushMethod, new GitPushParams(folder, basedOn).toJson());
  }

  public async pullAsync(folder: string, basedOn: string): Promise<void> {
    await this.context.requestAsync(GitNames.pullMethod, new GitPullParams(folder, basedOn).toJson());
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
