/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TimerOptions } from "node:timers";
import timers from "node:timers/promises";

import { vi } from "vitest";

export class MockClock {
  public static use(now: number): void {
    vi.useFakeTimers({ now });
    vi.spyOn(timers, "setTimeout").mockImplementation(MockClock.waitAsync);
  }

  /** Node's timers.setTimeout as the mock takes it, whose generic value it sees as unknown, so the value passes through without a cast. */
  private static waitAsync(delay?: number, value?: unknown, options?: TimerOptions): Promise<unknown> {
    const signal: AbortSignal | undefined = options?.signal;
    return new Promise<unknown>((resolve, reject) => {
      if (signal?.aborted === true) {
        reject(signal.reason);
        return;
      }
      const stop = (): void => {
        clearTimeout(timer);
        reject(signal?.reason);
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", stop);
        resolve(value);
      }, delay);
      signal?.addEventListener("abort", stop, { once: true });
    });
  }
}
