/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { KeyQueue } from "../../src/services/key-queue.ts";

describe("KeyQueue", () => {
  test("runs the calls for one key one at a time, in order, also after one fails", async () => {
    const queue = new KeyQueue();
    const events: string[] = [];
    const first = Promise.withResolvers<void>();

    const running = [
      queue.runAsync("k", async () => {
        events.push("first start");
        await first.promise;
        events.push("first end");
        throw new Error("First failed.");
      }),
      queue.runAsync("k", async () => {
        events.push("second");
        return 2;
      })
    ];
    await Promise.resolve();
    assert.deepEqual(events, ["first start"]);
    first.resolve();

    const [failed, second] = await Promise.allSettled(running);
    assert.equal(failed?.status, "rejected");
    assert.deepEqual(second, { status: "fulfilled", value: 2 });
    assert.deepEqual(events, ["first start", "first end", "second"]);
  });

  test("runs the calls for keys that differ only in case or spelling at the same time", async () => {
    const queue = new KeyQueue();
    const upper = Promise.withResolvers<void>();
    const events: string[] = [];

    const blocked = queue.runAsync("Key", async () => {
      await upper.promise;
      events.push("Key");
    });
    await queue.runAsync("key", async () => {
      events.push("key");
    });
    await queue.runAsync("./key", async () => {
      events.push("./key");
    });
    upper.resolve();
    await blocked;

    assert.deepEqual(events, ["key", "./key", "Key"]);
  });
});
