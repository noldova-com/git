/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class GitCommitFileRow {
  public readonly key: string;
  public readonly name: string;
  public readonly from: string;
  public readonly isFolder: boolean;
  public readonly depth: number;
  public readonly letter: string;
  public readonly added: number | null;
  public readonly removed: number | null;

  public constructor(key: string, name: string, from: string, isFolder: boolean, depth: number, letter: string, added: number | null,
    removed: number | null) {
    this.key = key;
    this.name = name;
    this.from = from;
    this.isFolder = isFolder;
    this.depth = depth;
    this.letter = letter;
    this.added = added;
    this.removed = removed;
  }
}
