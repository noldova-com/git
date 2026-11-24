/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { FileState, StatusEntry } from "@noldova/git.protocol";

import { LfsCheck } from "../../src/models/lfs-check.ts";

describe("LfsCheck", () => {
  test("keeps the entries left and how many LFS files it couldn't check", () => {
    const entries = [new StatusEntry("a.bin", undefined, null, undefined, FileState.Unmodified, FileState.Modified, null, null, null, null)];
    const check = new LfsCheck(entries, 3);

    assert.equal(check.entries, entries);
    assert.equal(check.unchecked, 3);
  });
});
