/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** A folder a workspace moves, with its place in the workspace's order before the move. */
export class GitMovingFolder {
  public readonly folder: string;
  public readonly index: number;

  public constructor(folder: string, index: number) {
    this.folder = folder;
    this.index = index;
  }
}
