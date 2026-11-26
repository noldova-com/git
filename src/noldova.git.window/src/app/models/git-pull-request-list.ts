/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitPullRequestsState } from "../enums/git-pull-requests-state.ts";
import type { GitPullRequestRow } from "./git-pull-request-row.ts";

export class GitPullRequestList {
  public readonly state: GitPullRequestsState;
  public readonly rows: readonly GitPullRequestRow[];
  public readonly failure: string | null;
  public readonly hasMore: boolean;

  private constructor(state: GitPullRequestsState, rows: readonly GitPullRequestRow[], failure: string | null, hasMore: boolean) {
    this.state = state;
    this.rows = rows;
    this.failure = failure;
    this.hasMore = hasMore;
  }

  public static reading(rows: readonly GitPullRequestRow[] = []): GitPullRequestList {
    return new GitPullRequestList(GitPullRequestsState.Reading, rows, null, false);
  }

  public static ready(rows: readonly GitPullRequestRow[], hasMore: boolean = false): GitPullRequestList {
    return new GitPullRequestList(GitPullRequestsState.Ready, rows, null, hasMore);
  }

  public static signedOut(): GitPullRequestList {
    return new GitPullRequestList(GitPullRequestsState.SignedOut, [], null, false);
  }

  public static failed(failure: string, rows: readonly GitPullRequestRow[] = []): GitPullRequestList {
    return new GitPullRequestList(GitPullRequestsState.Failed, rows, failure, false);
  }
}
