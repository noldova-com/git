/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { PendingWatch } from "../../src/models/pending-watch.ts";

describe("PendingWatch", () => {
  test("carries the watching window and folder, not yet cancelled", () => {
    assert.deepEqual({ ...new PendingWatch(1, 2, "/r") }, { connection: 1, window: 2, folder: "/r", isCancelled: false });
  });
});
