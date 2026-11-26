/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { AheadBehind } from "../../src/models/ahead-behind.ts";

describe("AheadBehind", () => {
  test("keeps both counts", () => {
    const counts = new AheadBehind(3, 1);

    assert.deepEqual([counts.ahead, counts.behind], [3, 1]);
  });
});
