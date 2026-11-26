/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class LineCounts {
  public readonly added: number;
  public readonly removed: number;

  public constructor(added: number, removed: number) {
    this.added = added;
    this.removed = removed;
  }
}
