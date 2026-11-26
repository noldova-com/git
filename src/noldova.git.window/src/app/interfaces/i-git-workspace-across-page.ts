/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitPullRequestRow } from "../models/git-pull-request-row.ts";
import type { GitWorkspaceReview } from "../models/git-workspace-review.ts";
import type { GitWorkspaceRow } from "../models/git-workspace-row.ts";

export interface IGitWorkspaceAcrossPage {
  open(folder: string): void;
  openPullRequest(row: GitWorkspaceRow, pullRequest: GitPullRequestRow): void;
  openReview(review: GitWorkspaceReview): void;
  readWritten(folders: readonly string[]): void;
}
