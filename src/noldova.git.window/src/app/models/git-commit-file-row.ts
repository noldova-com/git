/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** A row of a commit's changed files: a folder, or a file with its change letter and line counts. */
export class GitCommitFileRow {
  /** The folder's path, or the file's path; a folder opens and closes by it. */
  public readonly key: string;
  public readonly name: string;
  /** The whole path a renamed or copied file had before, or an empty string; the row shows its name and keeps the path in its title. */
  public readonly from: string;
  public readonly isFolder: boolean;
  /** How many levels in the row steps. */
  public readonly depth: number;
  /** The file's change letter, with a rename's or copy's similarity after it, such as "R 92%". */
  public readonly letter: string;
  /** The lines the file adds and removes, or `null` for a folder or a file without text lines, such as a binary one. */
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
