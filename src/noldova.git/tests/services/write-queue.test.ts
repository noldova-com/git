/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import path from "node:path";

import { describe, test } from "vitest";

import { WriteQueue } from "../../src/services/write-queue.ts";

describe("WriteQueue", () => {
  test("work under one key runs one at a time, even after a failure", async () => {
    const queue = new WriteQueue();
    const first = Promise.withResolvers<void>();
    const order: string[] = [];

    const failing = queue.runAsync("repository", async () => {
      order.push("first started");
      await first.promise;
      throw new Error("The first write failed.");
    });
    const second = queue.runAsync("repository", async () => {
      order.push("second started");
      return "second";
    });
    order.push("both asked");
    first.resolve();

    await assert.rejects(failing, /first write failed/v);
    assert.equal(await second, "second");
    assert.deepEqual(order, ["both asked", "first started", "second started"]);
  });

  test("work under different keys runs at the same time", async () => {
    const queue = new WriteQueue();
    const first = Promise.withResolvers<void>();
    const secondStarted = Promise.withResolvers<void>();

    const one = queue.runAsync("one", async () => {
      await secondStarted.promise;
      await first.promise;
      return 1;
    });
    const two = queue.runAsync("two", async () => {
      secondStarted.resolve();
      return 2;
    });

    assert.equal(await two, 2);
    first.resolve();
    assert.equal(await one, 1);
  });

  test("one folder named in different forms shares one queue", async () => {
    const queue = new WriteQueue();
    const first = Promise.withResolvers<void>();
    const order: string[] = [];
    const folder = path.resolve("repository", ".git");

    const one = queue.runAsync(folder, async () => {
      await first.promise;
      order.push("first ended");
    });
    const two = queue.runAsync(`${folder.toUpperCase()}${path.sep}`, async () => {
      order.push("second started");
    });
    first.resolve();
    await Promise.all([one, two]);

    assert.deepEqual(order, ["first ended", "second started"]);
  });
});
