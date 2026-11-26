/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitRefChip } from "./git-ref-chip.ts";

export class GitChipSplit {
  public readonly shown: readonly GitRefChip[];
  public readonly hidden: readonly GitRefChip[];

  public constructor(shown: readonly GitRefChip[], hidden: readonly GitRefChip[]) {
    this.shown = shown;
    this.hidden = hidden;
  }
}
