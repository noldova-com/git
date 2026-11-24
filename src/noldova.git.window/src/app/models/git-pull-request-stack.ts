/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitPullRequestRow } from "./git-pull-request-row.ts";
import type { GitWorkspaceRow } from "./git-workspace-row.ts";

/** Open pull requests of one repository stacked on each other, each based on one before it, which merge in order: the bottom one first. */
export class GitPullRequestStack {
  /** The repository whose host listed them. */
  public readonly row: GitWorkspaceRow;
  /** The one at the bottom, based on no other open pull request, which merges first. */
  public readonly bottom: GitPullRequestRow;
  /** All of them in the order they merge, the bottom one first. */
  public readonly pullRequests: readonly GitPullRequestRow[];

  public constructor(row: GitWorkspaceRow, bottom: GitPullRequestRow, above: readonly GitPullRequestRow[]) {
    this.row = row;
    this.bottom = bottom;
    this.pullRequests = [bottom, ...above];
  }
}
