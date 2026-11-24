/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitWorkspaceReview } from "./git-workspace-review.ts";

/** The pull requests across the workspace's repositories that ask the signed-in person for a review, and whether a host's answer was cut. */
export class GitWorkspaceReviews {
  /** The repositories in the workspace's order, each pull request once, newest first within a repository. */
  public readonly rows: readonly GitWorkspaceReview[];
  /** Whether a host's answer was cut, so there may be more than these. */
  public readonly hasMore: boolean;

  public constructor(rows: readonly GitWorkspaceReview[], hasMore: boolean) {
    this.rows = rows;
    this.hasMore = hasMore;
  }
}
