/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitPullRequestsState } from "../enums/git-pull-requests-state.ts";
import type { GitPullRequestRow } from "./git-pull-request-row.ts";

/** A host's open pull requests in a repository, newest first, with where its read stands and, when it failed, why. */
export class GitPullRequestList {
  public readonly state: GitPullRequestsState;
  public readonly rows: readonly GitPullRequestRow[];
  /** Why the read failed, in the host's words, or null. */
  public readonly failure: string | null;
  /** Whether the host's answer was cut, so there may be more past the rows. */
  public readonly hasMore: boolean;

  private constructor(state: GitPullRequestsState, rows: readonly GitPullRequestRow[], failure: string | null, hasMore: boolean) {
    this.state = state;
    this.rows = rows;
    this.failure = failure;
    this.hasMore = hasMore;
  }

  /** A read that runs, keeping the rows the last one gave, if any, until it ends. */
  public static reading(rows: readonly GitPullRequestRow[] = []): GitPullRequestList {
    return new GitPullRequestList(GitPullRequestsState.Reading, rows, null, false);
  }

  public static ready(rows: readonly GitPullRequestRow[], hasMore: boolean = false): GitPullRequestList {
    return new GitPullRequestList(GitPullRequestsState.Ready, rows, null, hasMore);
  }

  public static signedOut(): GitPullRequestList {
    return new GitPullRequestList(GitPullRequestsState.SignedOut, [], null, false);
  }

  /** A read that failed, keeping the rows the last one gave, if any, as review requests do. */
  public static failed(failure: string, rows: readonly GitPullRequestRow[] = []): GitPullRequestList {
    return new GitPullRequestList(GitPullRequestsState.Failed, rows, failure, false);
  }
}
