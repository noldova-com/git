/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

export class WriteQueue {
  private readonly tails: Map<string, Promise<void>> = new Map();

  public async runAsync<T>(folder: string, work: () => Promise<T>): Promise<T> {
    const key = path.resolve(folder).toLowerCase();
    const previous = this.tails.get(key) ?? Promise.resolve();
    const { promise: done, resolve: release } = Promise.withResolvers<void>();
    const tail = previous.then(() => done);
    this.tails.set(key, tail);
    await previous;
    try {
      return await work();
    } finally {
      release();
      if (this.tails.get(key) === tail)
        this.tails.delete(key);
    }
  }
}
