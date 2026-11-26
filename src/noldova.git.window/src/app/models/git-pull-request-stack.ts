/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitPullRequestRow } from "./git-pull-request-row.ts";
import type { GitWorkspaceRow } from "./git-workspace-row.ts";

export class GitPullRequestStack {
  public readonly row: GitWorkspaceRow;
  public readonly bottom: GitPullRequestRow;
  public readonly pullRequests: readonly GitPullRequestRow[];

  public constructor(row: GitWorkspaceRow, bottom: GitPullRequestRow, above: readonly GitPullRequestRow[]) {
    this.row = row;
    this.bottom = bottom;
    this.pullRequests = [bottom, ...above];
  }
}
