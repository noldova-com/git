/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { KeyQueue } from "./key-queue.ts";

interface IWaitingRead<T> {
  readonly promise: Promise<T>;
  readonly controller: AbortController;
  users: number;
}

export class SharedReads<T> {
  private readonly queue: KeyQueue;
  private readonly waiting: Map<string, IWaitingRead<T>> = new Map();

  public constructor(queue: KeyQueue) {
    this.queue = queue;
  }

  public async runAsync(lane: string, key: string, signal: AbortSignal, read: (signal: AbortSignal) => Promise<T>): Promise<T> {
    signal.throwIfAborted();
    const shared: string = `${lane}\u0000${key}`;
    let waiting: IWaitingRead<T> | undefined = this.waiting.get(shared);
    if (Object.isUndefined(waiting)) {
      const controller: AbortController = new AbortController();
      const promise: Promise<T> = this.queue.runAsync(lane, () => {
        if (this.waiting.get(shared) === waiting)
          this.waiting.delete(shared);
        controller.signal.throwIfAborted();
        return read(controller.signal);
      });
      waiting = { promise, controller, users: 0 };
      this.waiting.set(shared, waiting);
      promise.catch(() => undefined);
    }
    const joined: IWaitingRead<T> = waiting;
    joined.users += 1;
    const { promise: aborted, reject } = Promise.withResolvers<never>();
    const leave = (): void => {
      joined.users -= 1;
      if (joined.users === 0) {
        if (this.waiting.get(shared) === joined)
          this.waiting.delete(shared);
        joined.controller.abort(signal.reason);
      }
      reject(signal.reason);
    };
    signal.addEventListener("abort", leave, { once: true });
    try {
      return await Promise.race([joined.promise, aborted]);
    } finally {
      signal.removeEventListener("abort", leave);
    }
  }
}
