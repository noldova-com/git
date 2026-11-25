/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { GitPullRequestState } from "../enums/git-pull-request-state.ts";
import { GitPullRequestsState } from "../enums/git-pull-requests-state.ts";
import type { GitPullRequestRow } from "./git-pull-request-row.ts";
import { GitCheckCounts } from "./git-check-counts.ts";

/**
 * A branch's newest pull request on its host, in any state, with its checks; or, when the branch has none, the checks of its head commit.
 * The workspace page shows it in a repository's Pull request and Checks cells.
 */
export class GitBranchPullRequest {
  /** Where the host's read stands. */
  public readonly state: GitPullRequestsState;
  /** The pull request, which a click opens through the host, or null when the branch has none or the read has no answer. */
  public readonly pullRequest: GitPullRequestRow | null;
  /** Where the pull request stands, or null without one. */
  public readonly pullRequestState: GitPullRequestState | null;
  /** Whether the open pull request waits for its reviews: none approves it or requests changes. */
  public readonly isWaitingForReview: boolean;
  /** The checks that passed, failed, and still run or wait: the pull request's, or the head commit's without one. */
  public readonly passed: number;
  public readonly failing: number;
  public readonly pending: number;
  /** Why the read failed, in the host's words, or null. */
  public readonly failure: string | null;
  /** The host's own word for where the pull request stands, such as Azure DevOps' "Completed", or null to use Git's word for its state. */
  public readonly stateLabel: string | null;

  private constructor(state: GitPullRequestsState, pullRequest: GitPullRequestRow | null, pullRequestState: GitPullRequestState | null, isWaitingForReview: boolean,
    counts: GitCheckCounts, failure: string | null, stateLabel: string | null = null) {
    this.state = state;
    this.pullRequest = pullRequest;
    this.pullRequestState = pullRequestState;
    this.isWaitingForReview = isWaitingForReview;
    this.passed = counts.passed;
    this.failing = counts.failing;
    this.pending = counts.pending;
    this.failure = failure;
    this.stateLabel = stateLabel;
  }

  /** A read that runs, keeping what the last one gave, if any, until it ends. */
  public static reading(last: GitBranchPullRequest | null = null): GitBranchPullRequest {
    return Object.isNull(last) ? new GitBranchPullRequest(GitPullRequestsState.Reading, null, null, false, GitCheckCounts.NONE, null)
      : new GitBranchPullRequest(GitPullRequestsState.Reading, last.pullRequest, last.pullRequestState, last.isWaitingForReview, new GitCheckCounts(last.passed, last.failing, last.pending), null,
        last.stateLabel);
  }

  /** The branch's pull request, with its checks counted on the row. */
  public static of(pullRequest: GitPullRequestRow, state: GitPullRequestState, isWaitingForReview: boolean, stateLabel: string | null = null): GitBranchPullRequest {
    return new GitBranchPullRequest(GitPullRequestsState.Ready, pullRequest, state, isWaitingForReview, new GitCheckCounts(pullRequest.passed, pullRequest.failing, pullRequest.pending), null,
      stateLabel);
  }

  /** No pull request for the branch, with its head commit's checks. */
  public static none(passed: number, failing: number, pending: number): GitBranchPullRequest {
    return new GitBranchPullRequest(GitPullRequestsState.Ready, null, null, false, new GitCheckCounts(passed, failing, pending), null);
  }

  public static signedOut(): GitBranchPullRequest {
    return new GitBranchPullRequest(GitPullRequestsState.SignedOut, null, null, false, GitCheckCounts.NONE, null);
  }

  /** A read that failed, with why in the host's words, or null when it gave none. */
  public static failed(failure: string | null): GitBranchPullRequest {
    return new GitBranchPullRequest(GitPullRequestsState.Failed, null, null, false, GitCheckCounts.NONE, failure);
  }
}
