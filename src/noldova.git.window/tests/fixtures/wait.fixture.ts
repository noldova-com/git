/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Wait {
  private static readonly POLL_INTERVAL: number = 1;

  public static async until(check: () => boolean): Promise<void> {
    while (!check())
      await new Promise<void>(resolve => setTimeout(resolve, Wait.POLL_INTERVAL));
  }
}
