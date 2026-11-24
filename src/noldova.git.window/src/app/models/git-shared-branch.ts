/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitWorkspaceRow } from "./git-workspace-row.ts";

/** A branch that two or more of a workspace's repositories have out, with a pull request in at least one: one change across them. */
export class GitSharedBranch {
  public readonly branch: string;
  /** The repositories that have the branch out, in the workspace's order. */
  public readonly rows: readonly GitWorkspaceRow[];

  public constructor(branch: string, rows: readonly GitWorkspaceRow[]) {
    this.branch = branch;
    this.rows = rows;
  }
}
