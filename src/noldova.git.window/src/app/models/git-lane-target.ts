/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** A lane a commit's line runs to in the history's graph, with the line's color. */
export class GitLaneTarget {
  public readonly lane: number;
  public readonly color: number;

  public constructor(lane: number, color: number) {
    this.lane = lane;
    this.color = color;
  }
}
