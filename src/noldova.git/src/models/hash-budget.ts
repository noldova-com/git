/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** The bytes one check may still hash, so a check of many large files stays bounded. */
export class HashBudget {
  private remainingBytes: number;

  public constructor(bytes: number) {
    this.remainingBytes = bytes;
  }

  /** Takes the bytes from the budget, or takes nothing and returns `false` when the budget can't cover them. */
  public take(bytes: number): boolean {
    if (bytes > this.remainingBytes)
      return false;
    this.remainingBytes -= bytes;
    return true;
  }
}
