/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** A test waiting until a number of requests have been answered, and how to let it go on. */
export class AnswerWaiter {
  public readonly count: number;
  public readonly resolve: () => void;

  public constructor(count: number, resolve: () => void) {
    this.count = count;
    this.resolve = resolve;
  }
}
