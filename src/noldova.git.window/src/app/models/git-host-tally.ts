/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitPullRequestsState } from "../enums/git-pull-requests-state.ts";

/** What the workspace rows that a host claims show of it so far: their remotes and their reads' states. */
export class GitHostTally {
  public readonly remotes: Set<string> = new Set();
  public readonly states: Set<GitPullRequestsState | null> = new Set();

  public add(remote: string, state: GitPullRequestsState | null): void {
    this.remotes.add(remote);
    this.states.add(state);
  }
}
