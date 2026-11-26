/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { HostPullRequest, HostReviewer } from "@noldova/git.hosting.protocol";

import type { IPullRequestActions } from "../interfaces/i-pull-request-actions.ts";

export class PullRequestChoice {
  public readonly pullRequest: HostPullRequest;
  public readonly reviewers: readonly HostReviewer[];
  public readonly readAt: number;
  public readonly actions: IPullRequestActions;

  public constructor(pullRequest: HostPullRequest, reviewers: readonly HostReviewer[], readAt: number, actions: IPullRequestActions) {
    this.pullRequest = pullRequest;
    this.reviewers = reviewers;
    this.readAt = readAt;
    this.actions = actions;
  }
}
