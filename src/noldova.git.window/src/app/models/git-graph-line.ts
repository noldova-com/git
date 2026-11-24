/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** One stroke of a graph row, from a lane at the row's top or middle to a lane at its middle or bottom. */
export class GitGraphLine {
  public readonly fromLane: number;
  public readonly fromMiddle: boolean;
  public readonly toLane: number;
  public readonly toMiddle: boolean;
  public readonly color: number;

  public constructor(fromLane: number, fromMiddle: boolean, toLane: number, toMiddle: boolean, color: number) {
    this.fromLane = fromLane;
    this.fromMiddle = fromMiddle;
    this.toLane = toLane;
    this.toMiddle = toMiddle;
    this.color = color;
  }
}
