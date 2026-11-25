/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** A name at one level of the branch tree: a branch, or a folder with the names under it. */
export class GitBranchTreeNode {
  public readonly name: string;
  /** The names under a folder, or null for a branch. */
  public readonly children: readonly string[] | null;

  public constructor(name: string, children: readonly string[] | null) {
    this.name = name;
    this.children = children;
  }
}
