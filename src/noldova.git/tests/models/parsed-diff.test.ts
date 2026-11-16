/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { ParsedDiff } from "../../src/models/parsed-diff.ts";

describe("ParsedDiff", () => {
  test("carries the files read, the ones left out and whether git's output was cut", () => {
    assert.deepEqual({ ...new ParsedDiff([], 2, true) }, { files: [], omittedFiles: 2, isCut: true });
  });
});
