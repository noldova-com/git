/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IGitAgents } from "../interfaces/i-git-agents.ts";
import type { GitAgentRow } from "./git-agent-row.ts";

/** An agent's run in one of a workspace's repositories, with the module that runs it, which opens it. */
export class GitWorkspaceRun {
  public readonly folder: string;
  /** The repository's name, as its row shows it. */
  public readonly repository: string;
  public readonly provider: IGitAgents;
  public readonly row: GitAgentRow;

  public constructor(folder: string, repository: string, provider: IGitAgents, row: GitAgentRow) {
    this.folder = folder;
    this.repository = repository;
    this.provider = provider;
    this.row = row;
  }

  /** Whether the run works in a worktree of its own rather than in the repository's folder. */
  public get hasOwnWorktree(): boolean {
    return this.row.worktree !== this.folder;
  }
}
