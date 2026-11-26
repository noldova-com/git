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

export class GitBranchPullRequest {
  public readonly state: GitPullRequestsState;
  public readonly pullRequest: GitPullRequestRow | null;
  public readonly pullRequestState: GitPullRequestState | null;
  public readonly isWaitingForReview: boolean;
  public readonly passed: number;
  public readonly failing: number;
  public readonly pending: number;
  public readonly failure: string | null;
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

  public static reading(last: GitBranchPullRequest | null = null): GitBranchPullRequest {
    return Object.isNull(last) ? new GitBranchPullRequest(GitPullRequestsState.Reading, null, null, false, GitCheckCounts.NONE, null)
      : new GitBranchPullRequest(GitPullRequestsState.Reading, last.pullRequest, last.pullRequestState, last.isWaitingForReview, new GitCheckCounts(last.passed, last.failing, last.pending), null,
        last.stateLabel);
  }

  public static of(pullRequest: GitPullRequestRow, state: GitPullRequestState, isWaitingForReview: boolean, stateLabel: string | null = null): GitBranchPullRequest {
    return new GitBranchPullRequest(GitPullRequestsState.Ready, pullRequest, state, isWaitingForReview, new GitCheckCounts(pullRequest.passed, pullRequest.failing, pullRequest.pending), null,
      stateLabel);
  }

  public static none(passed: number, failing: number, pending: number): GitBranchPullRequest {
    return new GitBranchPullRequest(GitPullRequestsState.Ready, null, null, false, new GitCheckCounts(passed, failing, pending), null);
  }

  public static signedOut(): GitBranchPullRequest {
    return new GitBranchPullRequest(GitPullRequestsState.SignedOut, null, null, false, GitCheckCounts.NONE, null);
  }

  public static failed(failure: string | null): GitBranchPullRequest {
    return new GitBranchPullRequest(GitPullRequestsState.Failed, null, null, false, GitCheckCounts.NONE, failure);
  }
}
