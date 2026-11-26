/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IGitPullRequests } from "../interfaces/i-git-pull-requests.ts";
import type { GitPullRequestRow } from "./git-pull-request-row.ts";

export class GitWorkspaceReview {
  public readonly row: GitPullRequestRow;
  public readonly folder: string;
  public readonly repository: string;
  public readonly host: IGitPullRequests;

  public constructor(row: GitPullRequestRow, folder: string, repository: string, host: IGitPullRequests) {
    this.row = row;
    this.folder = folder;
    this.repository = repository;
    this.host = host;
  }
}
