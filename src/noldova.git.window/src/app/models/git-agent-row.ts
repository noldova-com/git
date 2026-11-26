/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitAgentState } from "../enums/git-agent-state.ts";

export class GitAgentRow {
  public readonly key: string;
  public readonly name: string;
  public readonly state: GitAgentState;
  public readonly worktree: string;

  public constructor(key: string, name: string, state: GitAgentState, worktree: string) {
    this.key = key;
    this.name = name;
    this.state = state;
    this.worktree = worktree;
  }
}
