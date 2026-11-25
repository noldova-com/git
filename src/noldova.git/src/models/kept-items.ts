/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** The items the protocol takes, up to the limit, and whether any were left out, past the limit or refused. */
export class KeptItems<T> {
  public readonly items: T[];
  public readonly cut: boolean;

  public constructor(items: T[], cut: boolean) {
    this.items = items;
    this.cut = cut;
  }
}
