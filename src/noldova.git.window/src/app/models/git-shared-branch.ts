/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitWorkspaceRow } from "./git-workspace-row.ts";

export class GitSharedBranch {
  public readonly branch: string;
  public readonly rows: readonly GitWorkspaceRow[];

  public constructor(branch: string, rows: readonly GitWorkspaceRow[]) {
    this.branch = branch;
    this.rows = rows;
  }
}
