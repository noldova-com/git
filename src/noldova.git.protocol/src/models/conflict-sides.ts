/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ConflictSides {
  public readonly base: boolean;
  public readonly ours: boolean;
  public readonly theirs: boolean;

  public constructor(base: boolean, ours: boolean, theirs: boolean) {
    this.base = base;
    this.ours = ours;
    this.theirs = theirs;
  }
}
