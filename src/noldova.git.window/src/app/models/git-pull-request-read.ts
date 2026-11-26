/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Signal } from "@angular/core";

import type { IGitPullRequests } from "../interfaces/i-git-pull-requests.ts";
import type { GitBranchPullRequest } from "./git-branch-pull-request.ts";

export class GitPullRequestRead {
  public readonly host: IGitPullRequests;
  public readonly answer: Signal<GitBranchPullRequest | null>;

  public constructor(host: IGitPullRequests, answer: Signal<GitBranchPullRequest | null>) {
    this.host = host;
    this.answer = answer;
  }
}
