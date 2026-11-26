/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Signal } from "@angular/core";
import type { GitRemote } from "@noldova/git.protocol";

import type { GitBranchPullRequest } from "../models/git-branch-pull-request.ts";
import type { GitCommitComments } from "../models/git-commit-comments.ts";
import type { GitPullRequestList } from "../models/git-pull-request-list.ts";
import type { GitPullRequestRow } from "../models/git-pull-request-row.ts";

export interface IGitPullRequests {
  claims(remote: GitRemote): boolean;

  readonly hostName: string;

  readonly signInPage: string;

  listFor(folder: string, remote: GitRemote): Signal<GitPullRequestList | null>;

  refresh(folder: string, remote: GitRemote): void;

  branchFor?(folder: string, remote: GitRemote, branch: string, headCommit: string | null): Signal<GitBranchPullRequest | null>;

  refreshBranch?(folder: string, remote: GitRemote, branch: string, headCommit: string | null): void;

  stackListFor?(folder: string, remote: GitRemote): Signal<GitPullRequestList | null>;

  commitFor?(folder: string, remote: GitRemote, commitId: string): Signal<GitBranchPullRequest | null>;

  commentsFor?(folder: string, remote: GitRemote, commitId: string): Signal<GitCommitComments | null>;

  reviewsFor?(remote: GitRemote): Signal<GitPullRequestList | null>;

  refreshReviews?(remote: GitRemote): void;

  newPullRequestUrl?(remote: GitRemote, source: string, target: string): string | null;

  open?(folder: string, row: GitPullRequestRow): boolean;

  isShown?(folder: string, row: GitPullRequestRow): boolean;
}
