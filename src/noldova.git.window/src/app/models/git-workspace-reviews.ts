/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitWorkspaceReview } from "./git-workspace-review.ts";

export class GitWorkspaceReviews {
  public readonly rows: readonly GitWorkspaceReview[];
  public readonly hasMore: boolean;

  public constructor(rows: readonly GitWorkspaceReview[], hasMore: boolean) {
    this.rows = rows;
    this.hasMore = hasMore;
  }
}
