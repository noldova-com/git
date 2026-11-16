/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { ClientWatch } from "../../src/models/client-watch.ts";

describe("ClientWatch", () => {
  test("carries the watching window and folder, counted once", () => {
    assert.deepEqual({ ...new ClientWatch(1, null, "/r") }, { connection: 1, window: null, folder: "/r", count: 1 });
  });
});
