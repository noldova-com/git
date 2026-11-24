/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { RawDiffEntries } from "../../src/models/raw-diff-entries.ts";

describe("RawDiffEntries", () => {
  test("keeps the entries and the patch after them", () => {
    const patch = Buffer.from("diff --git a/a.txt b/a.txt");
    const read = new RawDiffEntries([], patch);

    assert.deepEqual(read.entries, []);
    assert.equal(read.patch, patch);
  });
});
