/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitRefChip } from "./git-ref-chip.ts";

export class GitChipDrag {
  public readonly chip: GitRefChip;
  public readonly labels: readonly GitRefChip[];
  public readonly branch: string;
  public readonly id: string;

  public constructor(chip: GitRefChip, labels: readonly GitRefChip[], branch: string, id: string) {
    this.chip = chip;
    this.labels = labels;
    this.branch = branch;
    this.id = id;
  }
}
