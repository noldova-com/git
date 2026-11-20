/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { CleanUps } from "./clean-ups.fixture.ts";

describe("CleanUps", () => {
  test("runs its steps once each, the last added first", async () => {
    const cleanUps = new CleanUps();
    const ran: string[] = [];
    cleanUps.add(() => {
      ran.push("repository");
    });
    cleanUps.add(async () => {
      await Promise.resolve();
      ran.push("desktop");
    });

    await cleanUps.runAsync();
    await cleanUps.runAsync();

    assert.deepEqual(ran, ["desktop", "repository"]);
  });

  test("runs every step when one fails, then throws that failure", async () => {
    const cleanUps = new CleanUps();
    const ran: string[] = [];
    cleanUps.add(() => {
      ran.push("repository");
    });
    cleanUps.add(() => {
      throw new Error("part");
    });
    cleanUps.add(() => {
      ran.push("desktop");
    });

    await assert.rejects(cleanUps.runAsync(), /^Error: part$/v);

    assert.deepEqual(ran, ["desktop", "repository"]);
  });
});
