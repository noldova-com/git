/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class GitBranchTreeNode {
  public readonly name: string;
  public readonly children: readonly string[] | null;

  public constructor(name: string, children: readonly string[] | null) {
    this.name = name;
    this.children = children;
  }
}
