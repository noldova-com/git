/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class KeptItems<T> {
  public readonly items: T[];
  public readonly cut: boolean;

  public constructor(items: T[], cut: boolean) {
    this.items = items;
    this.cut = cut;
  }
}
