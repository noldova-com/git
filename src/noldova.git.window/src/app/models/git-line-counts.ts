/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class GitLineCounts {
  public static readonly NONE: GitLineCounts = new GitLineCounts(0, 0);

  public readonly added: number;
  public readonly removed: number;

  public constructor(added: number, removed: number) {
    this.added = added;
    this.removed = removed;
  }

  public plus(other: GitLineCounts): GitLineCounts {
    return new GitLineCounts(this.added + other.added, this.removed + other.removed);
  }
}
