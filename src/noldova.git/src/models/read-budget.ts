/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** The bytes a count may still read, shared by the files it counts, so a count of many large files stays bounded. */
export class ReadBudget {
  public remainingBytes: number;

  public constructor(bytes: number) {
    this.remainingBytes = bytes;
  }
}
