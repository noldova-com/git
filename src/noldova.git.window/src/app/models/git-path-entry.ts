/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
/** A row of a laid-out file list: a folder, or one of the items, at its depth. */
export class GitPathEntry<T> {
  /** The folder's whole path, or an empty string for an item. */
  public readonly folder: string;
  /** The text the row shows: a folder's name, or its whole path in Folders, and an item's name, or its whole path where no folder row holds it. */
  public readonly name: string;
  /** How many levels in the row steps. */
  public readonly depth: number;
  /** The item, or `null` for a folder. */
  public readonly item: T | null;

  public constructor(folder: string, name: string, depth: number, item: T | null) {
    this.folder = folder;
    this.name = name;
    this.depth = depth;
    this.item = item;
  }
}
