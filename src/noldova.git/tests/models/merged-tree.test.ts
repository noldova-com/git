/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { MergedTree } from "../../src/models/merged-tree.ts";

describe("MergedTree", () => {
  test("keeps the tree and the conflicting paths", () => {
    const merged = new MergedTree("0123456789abcdef0123456789abcdef01234567", ["a.txt"]);

    assert.deepEqual([merged.tree, merged.paths], ["0123456789abcdef0123456789abcdef01234567", ["a.txt"]]);
  });
});
