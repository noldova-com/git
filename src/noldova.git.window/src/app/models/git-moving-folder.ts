/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class GitMovingFolder {
  public readonly folder: string;
  public readonly index: number;

  public constructor(folder: string, index: number) {
    this.folder = folder;
    this.index = index;
  }
}
