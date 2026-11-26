/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class GitMarkedLine {
  public readonly path: string;
  public readonly row: number;

  public constructor(path: string, row: number) {
    this.path = path;
    this.row = row;
  }

  public isAt(path: string, row: number): boolean {
    return this.path === path && this.row === row;
  }
}
