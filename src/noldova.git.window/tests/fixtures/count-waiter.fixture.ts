/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** A wait for something to happen a number of times: the count it waits for and what settles it. */
export class CountWaiter {
  public readonly count: number;
  public readonly resolve: () => void;

  public constructor(count: number, resolve: () => void) {
    this.count = count;
    this.resolve = resolve;
  }
}
