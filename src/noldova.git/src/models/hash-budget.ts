/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class HashBudget {
  private remainingBytes: number;

  public constructor(bytes: number) {
    this.remainingBytes = bytes;
  }

  public take(bytes: number): boolean {
    if (bytes > this.remainingBytes)
      return false;
    this.remainingBytes -= bytes;
    return true;
  }
}
