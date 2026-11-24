/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IGitPullRequests } from "../interfaces/i-git-pull-requests.ts";
import type { GitPullRequestRow } from "./git-pull-request-row.ts";

/** A pull request that asks the signed-in person for a review, as the workspace page's Needs you lists it: the row, its repository and its host. */
export class GitWorkspaceReview {
  public readonly row: GitPullRequestRow;
  /** The listed repository's folder it was read for, which the host's open() takes. */
  public readonly folder: string;
  /** The repository's name, as the workspace's rows show it. */
  public readonly repository: string;
  public readonly host: IGitPullRequests;

  public constructor(row: GitPullRequestRow, folder: string, repository: string, host: IGitPullRequests) {
    this.row = row;
    this.folder = folder;
    this.repository = repository;
    this.host = host;
  }
}
