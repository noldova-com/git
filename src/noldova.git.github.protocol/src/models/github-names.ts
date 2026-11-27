/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { HostCapabilities, HostCapability, HostingNames } from "@noldova/git.hosting.protocol";

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
  public static readonly readAuthorAvatarMethod: string = HostingNames.nameOf(GitHubNames.moduleId, HostingNames.readAuthorAvatarMethod);
  public static readonly readPullRequestsMethod: string = HostingNames.nameOf(GitHubNames.moduleId, HostingNames.readPullRequestsMethod);
  public static readonly readReviewRequestsMethod: string = HostingNames.nameOf(GitHubNames.moduleId, HostingNames.readReviewRequestsMethod);
  public static readonly readCommitCommentsMethod: string = HostingNames.nameOf(GitHubNames.moduleId, HostingNames.readCommitCommentsMethod);
  public static readonly readPullRequestMethod: string = HostingNames.nameOf(GitHubNames.moduleId, HostingNames.readPullRequestMethod);
  public static readonly readPullRequestThreadsMethod: string = HostingNames.nameOf(GitHubNames.moduleId, HostingNames.readPullRequestThreadsMethod);
  public static readonly readAccountsMethod: string = HostingNames.nameOf(GitHubNames.moduleId, HostingNames.readAccountsMethod);
  public static readonly addAccountMethod: string = HostingNames.nameOf(GitHubNames.moduleId, HostingNames.addAccountMethod);
  public static readonly readRepositoryAccountMethod: string = HostingNames.nameOf(GitHubNames.moduleId, HostingNames.readRepositoryAccountMethod);
  public static readonly pickAccountMethod: string = HostingNames.nameOf(GitHubNames.moduleId, HostingNames.pickAccountMethod);
  public static readonly accessService: string = HostingNames.nameOf(GitHubNames.moduleId, Resources.accessMember);
  public static readonly signInChangedEvent: string = HostingNames.nameOf(GitHubNames.moduleId, HostingNames.signInChangedEvent);
  public static readonly accountsChangedEvent: string = HostingNames.nameOf(GitHubNames.moduleId, HostingNames.accountsChangedEvent);
  public static readonly readTool: string = "git_github_read";
  public static readonly prChecksTool: string = "git_github_pr_checks";
  public static readonly prCreateTool: string = "git_github_pr_create";
  public static readonly manageAccessUrl: string = Resources.formatManageAccessUrl(GitHubNames.clientId);
  public static readonly capabilities: HostCapabilities = new HostCapabilities([HostCapability.SignIn, HostCapability.ReadItem,
    HostCapability.BranchPullRequest, HostCapability.CreatePullRequest, HostCapability.Checks, HostCapability.AuthorAvatars,
    HostCapability.PullRequests]);
}
