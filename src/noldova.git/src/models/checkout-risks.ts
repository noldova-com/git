/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class CheckoutRisks {
  public readonly hooks: readonly string[];
  public readonly filters: readonly string[];

  public constructor(hooks: readonly string[], filters: readonly string[]) {
    this.hooks = hooks;
    this.filters = filters;
  }
}
