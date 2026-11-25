/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** A lane of the history's graph: the commit id it waits for, or null while it is free, its color, and whether a merge opened it for its second or later parent. */
export class GitLane {
  public readonly waiting: string | null;
  public readonly color: number;
  public readonly isSide: boolean;

  public constructor(waiting: string | null, color: number, isSide: boolean) {
    this.waiting = waiting;
    this.color = color;
    this.isSide = isSide;
  }

  /** The lane with nothing to wait for, keeping its color and side. */
  public freed(): GitLane {
    return new GitLane(null, this.color, this.isSide);
  }
}
