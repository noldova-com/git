/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class GitSwitchTarget {
  public readonly folder: string;
  public readonly branch: string;

  public constructor(folder: string, branch: string) {
    this.folder = folder;
    this.branch = branch;
  }
}
