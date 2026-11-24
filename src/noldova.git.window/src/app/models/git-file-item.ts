/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitFileRow } from "./git-file-row.ts";

/** One line of a file group: a folder, or a file, at its depth. */
export class GitFileItem {
  public readonly key: string;
  /** The folder's whole path, or empty for a file. */
  public readonly folder: string;
  /** The text the line shows: a folder's name, or its whole path in Folders, and a file's name, or its whole path where no folder line holds it. */
  public readonly name: string;
  /** The file, or `null` for a folder. */
  public readonly row: GitFileRow | null;
  /** How many levels in the line steps. */
  public readonly depth: number;

  public constructor(key: string, folder: string, name: string, row: GitFileRow | null, depth: number) {
    this.key = key;
    this.folder = folder;
    this.name = name;
    this.row = row;
    this.depth = depth;
  }
}
