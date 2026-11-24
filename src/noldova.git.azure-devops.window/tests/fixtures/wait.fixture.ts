/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { vi } from "vitest";

export class Wait {
  private static readonly POLL_INTERVAL: number = 1;
  private static readonly TIMEOUT: number = 1_000;

  public static until<T>(check: () => T | Promise<T>, options: { readonly timeout?: number } = {}): Promise<T> {
    return vi.waitFor(check, { timeout: options.timeout ?? Wait.TIMEOUT, interval: Wait.POLL_INTERVAL });
  }
}
