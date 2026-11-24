/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitCommit, GitGraphCommit } from "@noldova/git.protocol";

import type { GitGraphLine } from "./git-graph-line.ts";

/** A commit's row in the graph: the lane its dot sits in, the strokes through the row, and how many lanes the row spans. */
export class GitGraphRow {
  /** The commit with its author's email and the labels on it. */
  public readonly shown: GitGraphCommit;
  public readonly commit: GitCommit;
  public readonly lane: number;
  public readonly color: number;
  public readonly lines: readonly GitGraphLine[];
  public readonly width: number;
  public readonly isMerge: boolean;

  public constructor(shown: GitGraphCommit, lane: number, color: number, lines: readonly GitGraphLine[], width: number) {
    this.shown = shown;
    this.commit = shown.commit;
    this.lane = lane;
    this.color = color;
    this.lines = lines;
    this.width = width;
    this.isMerge = shown.commit.parents.length > 1;
  }
}
