/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { CapturedOutput } from "../../src/models/captured-output.ts";

describe("CapturedOutput", () => {
  test("keeps the bytes and whether the limit cut them", () => {
    const output = new CapturedOutput(Buffer.from("out"), true);

    assert.equal(output.bytes.toString(), "out");
    assert.equal(output.isTruncated, true);
  });
});
