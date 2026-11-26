/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Signal } from "@angular/core";

import type { IGitPullRequests } from "../interfaces/i-git-pull-requests.ts";
import type { GitPullRequestList } from "./git-pull-request-list.ts";
import type { GitWorkspaceRow } from "./git-workspace-row.ts";

export class GitReviewsRead {
  public readonly row: GitWorkspaceRow;
  public readonly host: IGitPullRequests;
  public readonly list: Signal<GitPullRequestList | null>;

  public constructor(row: GitWorkspaceRow, host: IGitPullRequests, list: Signal<GitPullRequestList | null>) {
    this.row = row;
    this.host = host;
    this.list = list;
  }
}
