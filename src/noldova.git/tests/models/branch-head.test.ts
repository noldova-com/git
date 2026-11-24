/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { describe, test } from "vitest";

import { BranchHead } from "../../src/models/branch-head.ts";

const ID: string = "0123456789abcdef0123456789abcdef01234567";
const AT: string = "2026-11-23T10:00:00+01:00";
const SECONDS: string = "1795424400";

describe("BranchHead", () => {
  test("reads a branch's name, commit, commit time, that time in seconds and track from a for-each-ref record", () => {
    assert.deepEqual(BranchHead.parse(`main\t${ID}\t${AT}\t${SECONDS}\tahead 2, behind 1`), new BranchHead("main", ID, AT, SECONDS, "ahead 2, behind 1"));
  });

  test("reads an empty track when the record ends at the commit time in seconds, as it does once trimmed", () => {
    assert.deepEqual(BranchHead.parse(`feature/view\t${ID}\t${AT}\t${SECONDS}`), new BranchHead("feature/view", ID, AT, SECONDS, ""));
  });
});
