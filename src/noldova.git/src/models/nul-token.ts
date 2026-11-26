/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
export class NulToken {
  public readonly value: Buffer | null;
  public readonly next: number;

  public constructor(value: Buffer | null, next: number) {
    this.value = value;
    this.next = next;
  }
}
