/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
/** One NUL-ended field of git's output, or null when the output ends before its NUL, and where the next field starts. */
export class NulToken {
  public readonly value: Buffer | null;
  public readonly next: number;

  public constructor(value: Buffer | null, next: number) {
    this.value = value;
    this.next = next;
  }
}
