/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class GitBranchRow {
  public readonly key: string;
  public readonly name: string;
  public readonly depth: number;
  public readonly isFolder: boolean;
  public readonly count: number;
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
