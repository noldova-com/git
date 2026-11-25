/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** The line a reveal marked: its file's path and its row in the file's diff lines. */
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
