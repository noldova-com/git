/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { HostingNames } from "@noldova/git.hosting.protocol";

import { Resources } from "../resources.ts";

export class GitHubNames {
  public static readonly moduleId: string = "git-github";
  public static readonly clientId: string = "Ov23liRKBcNQMxG9PGar";
  public static readonly readSignInMethod: string = HostingNames.nameOf(GitHubNames.moduleId, HostingNames.readSignInMethod);
  public static readonly startSignInMethod: string = HostingNames.nameOf(GitHubNames.moduleId, HostingNames.startSignInMethod);
  public static readonly cancelSignInMethod: string = HostingNames.nameOf(GitHubNames.moduleId, HostingNames.cancelSignInMethod);
  public static readonly signOutMethod: string = HostingNames.nameOf(GitHubNames.moduleId, HostingNames.signOutMethod);
  public static readonly readReferenceMethod: string = HostingNames.nameOf(GitHubNames.moduleId, HostingNames.readReferenceMethod);
  public static readonly readBranchPullRequestMethod: string = HostingNames.nameOf(GitHubNames.moduleId, HostingNames.readBranchPullRequestMethod);
  public static readonly createPullRequestMethod: string = HostingNames.nameOf(GitHubNames.moduleId, HostingNames.createPullRequestMethod);
  public static readonly accessService: string = HostingNames.nameOf(GitHubNames.moduleId, Resources.accessMember);
  public static readonly signInChangedEvent: string = HostingNames.nameOf(GitHubNames.moduleId, HostingNames.signInChangedEvent);
  public static readonly readTool: string = "git_github_read";
  public static readonly prChecksTool: string = "git_github_pr_checks";
  public static readonly prCreateTool: string = "git_github_pr_create";
  public static readonly manageAccessUrl: string = Resources.formatManageAccessUrl(GitHubNames.clientId);
}
