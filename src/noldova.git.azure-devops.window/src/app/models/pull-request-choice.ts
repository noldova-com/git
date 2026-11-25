/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { HostPullRequest, HostReviewer } from "@noldova/git.hosting.protocol";

import type { IPullRequestActions } from "../interfaces/i-pull-request-actions.ts";

/**
 * The pull request a document shows, for the Pull request view: as the page read it, with its reviewers as the person's votes since have them, when the page
 * read it, which times a running build, and what the view hands back to the page.
 */
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
