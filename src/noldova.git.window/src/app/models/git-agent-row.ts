/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitAgentState } from "../enums/git-agent-state.ts";

/** One agent's run as the repository panel lists it: its task's name, where it stands and the worktree it works in. */
export class GitAgentRow {
  /** The provider's own key for the run, such as its id; the panel never reads it, and gives it back to the provider's open(). */
  public readonly key: string;
  /** The run's task, as a short name such as "Blame gutter". */
  public readonly name: string;
  public readonly state: GitAgentState;
  /** The folder of the worktree the run works in; the section's header counts the distinct ones. */
  public readonly worktree: string;

  public constructor(key: string, name: string, state: GitAgentState, worktree: string) {
    this.key = key;
    this.name = name;
    this.state = state;
    this.worktree = worktree;
  }
}
