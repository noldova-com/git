/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { HostCapabilities, HostCapability, HostingNames } from "@noldova/git.hosting.protocol";

export class AzureDevOpsNames {
  public static readonly moduleId: string = "git-azure-devops";
  public static readonly readSignInMethod: string = HostingNames.nameOf(AzureDevOpsNames.moduleId, HostingNames.readSignInMethod);
  public static readonly startSignInMethod: string = HostingNames.nameOf(AzureDevOpsNames.moduleId, HostingNames.startSignInMethod);
  public static readonly cancelSignInMethod: string = HostingNames.nameOf(AzureDevOpsNames.moduleId, HostingNames.cancelSignInMethod);
  public static readonly signInWithTokenMethod: string = HostingNames.nameOf(AzureDevOpsNames.moduleId, HostingNames.signInWithTokenMethod);
  public static readonly signOutMethod: string = HostingNames.nameOf(AzureDevOpsNames.moduleId, HostingNames.signOutMethod);
  public static readonly readReferenceMethod: string = HostingNames.nameOf(AzureDevOpsNames.moduleId, HostingNames.readReferenceMethod);
  public static readonly readBranchPullRequestMethod: string = HostingNames.nameOf(AzureDevOpsNames.moduleId, HostingNames.readBranchPullRequestMethod);
  public static readonly readCommitPullRequestMethod: string = HostingNames.nameOf(AzureDevOpsNames.moduleId, HostingNames.readCommitPullRequestMethod);
  public static readonly readPullRequestMethod: string = HostingNames.nameOf(AzureDevOpsNames.moduleId, HostingNames.readPullRequestMethod);
  public static readonly readWorkItemMethod: string = HostingNames.nameOf(AzureDevOpsNames.moduleId, HostingNames.readWorkItemMethod);
  public static readonly readWorkItemsMethod: string = HostingNames.nameOf(AzureDevOpsNames.moduleId, HostingNames.readWorkItemsMethod);
  public static readonly updateWorkItemMethod: string = HostingNames.nameOf(AzureDevOpsNames.moduleId, HostingNames.updateWorkItemMethod);
  public static readonly readAuthorAvatarMethod: string = HostingNames.nameOf(AzureDevOpsNames.moduleId, HostingNames.readAuthorAvatarMethod);
  public static readonly readPersonAvatarMethod: string = HostingNames.nameOf(AzureDevOpsNames.moduleId, HostingNames.readPersonAvatarMethod);
  public static readonly readPullRequestsMethod: string = HostingNames.nameOf(AzureDevOpsNames.moduleId, HostingNames.readPullRequestsMethod);
  public static readonly readPullRequestHeadsMethod: string = "git-azure-devops.readPullRequestHeads";
  public static readonly readPullRequestCommitsMethod: string = "git-azure-devops.readPullRequestCommits";
  public static readonly readPullRequestUpdatesMethod: string = "git-azure-devops.readPullRequestUpdates";
  public static readonly readPullRequestChangesMethod: string = "git-azure-devops.readPullRequestChanges";
  public static readonly readPullRequestConflictsMethod: string = "git-azure-devops.readPullRequestConflicts";
  public static readonly readReviewRequestsMethod: string = HostingNames.nameOf(AzureDevOpsNames.moduleId, HostingNames.readReviewRequestsMethod);
  public static readonly readCommitCommentsMethod: string = HostingNames.nameOf(AzureDevOpsNames.moduleId, HostingNames.readCommitCommentsMethod);
  public static readonly readPullRequestThreadsMethod: string = HostingNames.nameOf(AzureDevOpsNames.moduleId,
    HostingNames.readPullRequestThreadsMethod);
  public static readonly linkBranchMethod: string = "git-azure-devops.linkBranch";
  public static readonly replyToThreadMethod: string = "git-azure-devops.replyToThread";
  public static readonly changeThreadMethod: string = "git-azure-devops.changeThread";
  public static readonly voteMethod: string = "git-azure-devops.vote";
  public static readonly readMergeTypesMethod: string = "git-azure-devops.readMergeTypes";
  public static readonly completePullRequestMethod: string = "git-azure-devops.completePullRequest";
  public static readonly setAutoCompleteMethod: string = "git-azure-devops.setAutoComplete";
  public static readonly cancelAutoCompleteMethod: string = "git-azure-devops.cancelAutoComplete";
  public static readonly abandonPullRequestMethod: string = "git-azure-devops.abandonPullRequest";
  public static readonly searchPeopleMethod: string = "git-azure-devops.searchPeople";
  public static readonly addReviewerMethod: string = "git-azure-devops.addReviewer";
  public static readonly signInChangedEvent: string = HostingNames.nameOf(AzureDevOpsNames.moduleId, HostingNames.signInChangedEvent);
  public static readonly capabilities: HostCapabilities = new HostCapabilities([HostCapability.SignIn, HostCapability.ReadItem,
    HostCapability.BranchPullRequest, HostCapability.Checks, HostCapability.Votes, HostCapability.Policies, HostCapability.Builds,
    HostCapability.AutoComplete, HostCapability.WorkItems, HostCapability.AuthorAvatars, HostCapability.PullRequests]);
}
