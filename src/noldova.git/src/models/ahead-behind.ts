/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
export class AheadBehind {
  public readonly ahead: number;
  public readonly behind: number;

  public constructor(ahead: number, behind: number) {
    this.ahead = ahead;
    this.behind = behind;
  }
}
