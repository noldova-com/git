/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** A row of the side panel's branch trees: a remote, a folder of branches, or a branch, at its depth in the tree. */
export class GitBranchRow {
  /** The row's place in the tree, such as `origin/team/`; a folder opens and closes by it. */
  public readonly key: string;
  public readonly name: string;
  public readonly depth: number;
  public readonly isFolder: boolean;
  /** The branches under a remote; 0 for any other row. */
  public readonly count: number;
  /** A branch row's whole branch name, such as `team/a` for a local branch or `origin/team/a` for a remote one; empty for a folder. */
  public readonly branch: string;

  public constructor(key: string, name: string, depth: number, isFolder: boolean, count: number, branch: string) {
    this.key = key;
    this.name = name;
    this.depth = depth;
    this.isFolder = isFolder;
    this.count = count;
    this.branch = branch;
  }
}
