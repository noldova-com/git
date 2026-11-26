/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class GitLane {
  public readonly waiting: string | null;
  public readonly color: number;
  public readonly isSide: boolean;

  public constructor(waiting: string | null, color: number, isSide: boolean) {
    this.waiting = waiting;
    this.color = color;
    this.isSide = isSide;
  }

  public freed(): GitLane {
    return new GitLane(null, this.color, this.isSide);
  }
}
