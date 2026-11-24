/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
/** The tree `git merge-tree` wrote, holding conflict markers where it conflicts, and each path that conflicts, once. */
export class MergedTree {
  public readonly tree: string;
  public readonly paths: string[];

  public constructor(tree: string, paths: string[]) {
    this.tree = tree;
    this.paths = paths;
  }
}
