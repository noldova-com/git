/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";

export class HostingNames {
  public static readonly readSignInMethod: string = "readSignIn";
  public static readonly startSignInMethod: string = "startSignIn";
  public static readonly cancelSignInMethod: string = "cancelSignIn";
  public static readonly signInWithTokenMethod: string = "signInWithToken";
  public static readonly signOutMethod: string = "signOut";
  public static readonly signInChangedEvent: string = "signInChanged";
  public static readonly readAccountsMethod: string = "readAccounts";
  public static readonly addAccountMethod: string = "addAccount";
  public static readonly readRepositoryAccountMethod: string = "readRepositoryAccount";
  public static readonly pickAccountMethod: string = "pickAccount";
  public static readonly accountsChangedEvent: string = "accountsChanged";
  public static readonly readReferenceMethod: string = "readReference";
  public static readonly readBranchPullRequestMethod: string = "readBranchPullRequest";
  public static readonly readCommitPullRequestMethod: string = "readCommitPullRequest";
  public static readonly readPullRequestMethod: string = "readPullRequest";
  public static readonly createPullRequestMethod: string = "createPullRequest";
  public static readonly readAuthorAvatarMethod: string = "readAuthorAvatar";
  public static readonly readPersonAvatarMethod: string = "readPersonAvatar";
  public static readonly readWorkItemMethod: string = "readWorkItem";
  public static readonly readWorkItemsMethod: string = "readWorkItems";
  public static readonly updateWorkItemMethod: string = "updateWorkItem";
  public static readonly readPullRequestsMethod: string = "readPullRequests";
  public static readonly readReviewRequestsMethod: string = "readReviewRequests";
  public static readonly readCommitCommentsMethod: string = "readCommitComments";
  public static readonly readPullRequestThreadsMethod: string = "readPullRequestThreads";

  public static nameOf(moduleId: string, member: string): string {
    return Resources.formatMemberName(moduleId, member);
  }
}
