/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
export class GitPathEntry<T> {
  public readonly folder: string;
  public readonly name: string;
  public readonly depth: number;
  public readonly item: T | null;

  public constructor(folder: string, name: string, depth: number, item: T | null) {
    this.folder = folder;
    this.name = name;
    this.depth = depth;
    this.item = item;
  }
}
