/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitPullRequestRow } from "./git-pull-request-row.ts";
import type { GitWorkspaceRow } from "./git-workspace-row.ts";

export class GitRowPullRequest {
  public readonly row: GitWorkspaceRow;
  public readonly pullRequest: GitPullRequestRow;

  public constructor(row: GitWorkspaceRow, pullRequest: GitPullRequestRow) {
    this.row = row;
    this.pullRequest = pullRequest;
  }
}
