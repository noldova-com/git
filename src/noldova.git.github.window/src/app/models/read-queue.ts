/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class ReadQueue {
  private readonly limit: number;
  private readonly waiting: (() => Promise<void>)[] = [];
  private running: number = 0;

  public constructor(limit: number) {
    this.limit = limit;
  }

  public add(read: () => Promise<void>): void {
    if (this.running < this.limit)
      void this.runAsync(read);
    else
      this.waiting.push(read);
  }

  private async runAsync(read: () => Promise<void>): Promise<void> {
    this.running++;
    try {
      await read();
    }
    finally {
      this.running--;
      const next = this.waiting.shift();
      if (!Object.isUndefined(next))
        void this.runAsync(next);
    }
  }
}
