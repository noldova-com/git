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

  private static waitAsync<T>(delay?: number, value?: T, options?: TimerOptions): Promise<T> {
    const signal: AbortSignal | undefined = options?.signal;
    return new Promise<T>((resolve, reject) => {
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
        resolve(value as T);
      }, delay);
      signal?.addEventListener("abort", stop, { once: true });
    });
  }
}
