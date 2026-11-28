/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class CleanUps {
  private readonly steps: (() => Promise<void> | void)[] = [];

  public add(step: () => Promise<void> | void): void {
    this.steps.push(step);
  }

  public async runAsync(): Promise<void> {
    let failure: { readonly error: unknown } | undefined;
    for (const step of this.steps.splice(0).reverse()) {
      try {
        await step();
      }
      catch (error) {
        failure ??= { error };
      }
    }
    if (!Object.isUndefined(failure))
      throw failure.error;
  }
}
