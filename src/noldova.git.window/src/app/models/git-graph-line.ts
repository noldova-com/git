/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

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
