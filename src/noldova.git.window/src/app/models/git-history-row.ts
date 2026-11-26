/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitGraphRow } from "./git-graph-row.ts";
import { GitRefChip } from "./git-ref-chip.ts";
import type { GitChipSplit } from "./git-chip-split.ts";

export class GitHistoryRow {
  public readonly graph: GitGraphRow;
  public readonly chips: readonly GitRefChip[];
  public readonly isChanges: boolean;
  public readonly isHead: boolean;
  public readonly message: string;
  public readonly author: string;
  public readonly initials: string;
  public readonly avatar: string;
  public readonly age: string;
  public readonly matches: boolean;

  public constructor(graph: GitGraphRow, chips: readonly GitRefChip[], isChanges: boolean, isHead: boolean, message: string, author: string, initials: string,
    avatar: string, age: string, matches: boolean) {
    this.graph = graph;
    this.chips = chips;
    this.isChanges = isChanges;
    this.isHead = isHead;
    this.message = message;
    this.author = author;
    this.initials = initials;
    this.avatar = avatar;
    this.age = age;
    this.matches = matches;
  }

  public get id(): string {
    return this.graph.commit.id;
  }

  public chipsWithin(limit: number): GitChipSplit {
    return GitRefChip.split(this.chips, limit);
  }
}
