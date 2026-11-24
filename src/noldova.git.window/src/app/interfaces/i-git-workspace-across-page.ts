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

/** What the Across repositories view asks of the workspace page it shows: opening what it lists, and reading again what it wrote to. */
export interface IGitWorkspaceAcrossPage {
  /** Opens a repository's history. */
  open(folder: string): void;
  /** Opens a branch's pull request in its host's own page when it has one, else its page in the browser. */
  openPullRequest(row: GitWorkspaceRow, pullRequest: GitPullRequestRow): void;
  /** Opens a pull request that asks for the person's review in its host's own page when it has one, else its page in the browser. */
  openReview(review: GitWorkspaceReview): void;
  /** Reads again the repositories a push or pull wrote to, or tried to. */
  readWritten(folders: readonly string[]): void;
}
