/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class CleanUps {
  private readonly steps: (() => Promise<void> | void)[] = [];

  public add(step: () => Promise<void> | void): void {
    this.steps.push(step);
  }

  public async runAsync(): Promise<void> {
    await CleanUps.runEachAsync(this.steps.splice(0).reverse());
  }

  private static async runEachAsync(steps: readonly (() => Promise<void> | void)[]): Promise<void> {
    const [first, ...rest] = steps;
    if (first === undefined)
      return;
    try {
      await first();
    }
    finally {
      await CleanUps.runEachAsync(rest);
    }
  }
}
