/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { GitPullRequestState } from "../enums/git-pull-request-state.ts";
import type { IGitPullRequests } from "../interfaces/i-git-pull-requests.ts";
import type { GitBranchPullRequest } from "./git-branch-pull-request.ts";
import type { GitPullRequestRow } from "./git-pull-request-row.ts";
import { Resources } from "../../resources.ts";

export class GitCommitPullRequest {
  public readonly host: IGitPullRequests;
  public readonly row: GitPullRequestRow;
  public readonly state: GitPullRequestState;
  public readonly stateLabel: string;
  public readonly note: string;

  private constructor(host: IGitPullRequests, row: GitPullRequestRow, state: GitPullRequestState, answer: GitBranchPullRequest) {
    this.host = host;
    this.row = row;
    this.state = state;
    this.stateLabel = answer.stateLabel ?? Resources.commitPullRequestStates[state];
    this.note = Resources.formatCommitPullRequestNote(row.approvals, answer.passed, answer.failing, answer.pending);
  }

  public static of(host: IGitPullRequests, answer: GitBranchPullRequest | null): GitCommitPullRequest | null {
    return !Object.isNull(answer) && !Object.isNull(answer.pullRequest) && !Object.isNull(answer.pullRequestState)
      ? new GitCommitPullRequest(host, answer.pullRequest, answer.pullRequestState, answer) : null;
  }
}
