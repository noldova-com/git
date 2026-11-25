/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitRebaseRow } from "./git-rebase-row.ts";

/** Where the dragged rebase row would land, by index, and the rows as they would be. */
export class GitRebaseLanding {
  public readonly to: number;
  public readonly rows: readonly GitRebaseRow[];

  public constructor(to: number, rows: readonly GitRebaseRow[]) {
    this.to = to;
    this.rows = rows;
  }
}
