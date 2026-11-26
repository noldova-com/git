/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Wait {
  private static readonly POLL_INTERVAL: number = 1;

  public static async until<T>(check: () => T | Promise<T>): Promise<T> {
    for (;;) {
      try {
        return await check();
      }
      catch {
        await new Promise<void>(resolve => setTimeout(resolve, Wait.POLL_INTERVAL));
      }
    }
  }
}
