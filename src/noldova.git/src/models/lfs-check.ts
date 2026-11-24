/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { StatusEntry } from "@noldova/git.protocol";

/** What the LFS check left of a status's entries, and how many LFS files it couldn't check, which stay as Git reported them. */
export class LfsCheck {
  public readonly entries: readonly StatusEntry[];
  public readonly unchecked: number;

  public constructor(entries: readonly StatusEntry[], unchecked: number) {
    this.entries = entries;
    this.unchecked = unchecked;
  }
}
