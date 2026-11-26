/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { IndexBlob } from "../../src/models/index-blob.ts";

describe("IndexBlob", () => {
  test("keeps the blob's id and size", () => {
    const blob = new IndexBlob("0123456789abcdef0123456789abcdef01234567", 42);

    assert.deepEqual([blob.id, blob.size], ["0123456789abcdef0123456789abcdef01234567", 42]);
  });
});
