/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitGraphRow } from "./git-graph-row.ts";
import { GitRefChip } from "./git-ref-chip.ts";

/** What one row of the history shows: the graph row, its labels, and the texts of its columns. */
export class GitHistoryRow {
  public readonly graph: GitGraphRow;
  /** Every label of the row's commit, the current branch first. */
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

  /** The labels the row shows, at most `limit` of them, and those past it, which the row's `+N` label lists in its tooltip. */
  public chipsWithin(limit: number): readonly [readonly GitRefChip[], readonly GitRefChip[]] {
    return GitRefChip.split(this.chips, limit);
  }
}
