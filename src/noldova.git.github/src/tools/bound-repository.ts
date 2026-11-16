/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/context.json";
import { ServiceAccessException, ToolFailureCode, type ToolCall } from "@noldova/desktop.runtime";
import { GitFolderBinding, type GitRemote, type GitRepositories, type GitStatus, ProtocolException } from "@noldova/git.protocol";

import { GitHubRepository } from "../models/github-repository.ts";
import { Resources } from "../resources.ts";
import { GitHubToolFailures } from "./github-tool-failures.ts";

export class BoundRepository {
  public readonly host: string;
  public readonly path: string;
  public readonly branch: string;
  public readonly headCommit: string | null;

  private constructor(host: string, path: string, branch: string, headCommit: string | null) {
    this.host = host;
    this.path = path;
    this.branch = branch;
    this.headCommit = headCommit;
  }

  public static async readAsync(call: ToolCall, repositories: () => GitRepositories): Promise<BoundRepository> {
    const folder: string = BoundRepository.folderOf(call);
    let status: GitStatus;
    let origin: GitRemote | null;
    try {
      const reads: GitRepositories = repositories();
      status = await reads.readStatusAsync(folder, call.signal);
      origin = await reads.readRemoteAsync(folder, Resources.originRemote, call.signal);
    } catch (error) {
      throw error instanceof ServiceAccessException
        ? GitHubToolFailures.fail(ToolFailureCode.Unavailable, Resources.gitMissingToolMessage, Resources.gitUnavailableToolCode)
        : GitHubToolFailures.fromGit(error);
    }
    const host: string | null = origin?.host ?? null;
    const remotePath: string | null = origin?.path ?? null;
    const path: string | null = remotePath?.endsWith(Resources.gitSuffix) === true ? remotePath.slice(0, -Resources.gitSuffix.length) : remotePath;
    if (host !== Resources.host || path === null || GitHubRepository.parse(path) === null)
      throw GitHubToolFailures.fail(ToolFailureCode.Refused, Resources.notGitHubToolMessage, Resources.notGitHubToolCode);
    if (status.branch === null)
      throw GitHubToolFailures.fail(ToolFailureCode.Refused, Resources.detachedHeadToolMessage, Resources.detachedHeadToolCode);
    return new BoundRepository(host, path, status.branch, status.head);
  }

  private static folderOf(call: ToolCall): string {
    try {
      return GitFolderBinding.fromBindings(call.bindings).folder;
    } catch (error) {
      if (!(error instanceof JsonException || error instanceof ProtocolException))
        throw error;
      throw GitHubToolFailures.fail(ToolFailureCode.Refused, Resources.formatNoFolder(String(error)), Resources.noFolderToolCode);
    }
  }
}
