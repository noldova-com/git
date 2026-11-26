/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitFileRow } from "./git-file-row.ts";

export class GitFileItem {
  public readonly key: string;
  public readonly folder: string;
  public readonly name: string;
  public readonly row: GitFileRow | null;
  public readonly depth: number;

  public constructor(key: string, folder: string, name: string, row: GitFileRow | null, depth: number) {
    this.key = key;
    this.folder = folder;
    this.name = name;
    this.row = row;
    this.depth = depth;
  }
}
