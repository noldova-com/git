/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IGitAgents } from "../interfaces/i-git-agents.ts";
import type { GitAgentRow } from "./git-agent-row.ts";

export class GitWorkspaceRun {
  public readonly folder: string;
  public readonly repository: string;
  public readonly provider: IGitAgents;
  public readonly row: GitAgentRow;

  public constructor(folder: string, repository: string, provider: IGitAgents, row: GitAgentRow) {
    this.folder = folder;
    this.repository = repository;
    this.provider = provider;
    this.row = row;
  }

  public get hasOwnWorktree(): boolean {
    return this.row.worktree !== this.folder;
  }
}
