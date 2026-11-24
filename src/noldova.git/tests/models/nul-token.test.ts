/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { NulToken } from "../../src/models/nul-token.ts";

describe("NulToken", () => {
  test("keeps the field, or none, and where the next one starts", () => {
    const field = Buffer.from("a.txt");

    assert.deepEqual([new NulToken(field, 6).value, new NulToken(field, 6).next], [field, 6]);
    assert.deepEqual([new NulToken(null, 9).value, new NulToken(null, 9).next], [null, 9]);
  });
});
