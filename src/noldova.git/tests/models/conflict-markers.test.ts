/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { ConflictMarkers } from "../../src/models/conflict-markers.ts";

describe("ConflictMarkers", () => {
  test("finds each of git's marker lines, with or without a label, at any line's start", () => {
    for (const text of ["<<<<<<< ours\n", "a\n<<<<<<<\n", "a\n||||||| base\n", "a\n=======\nb", "b\n>>>>>>> theirs", "b\r\n>>>>>>>\r\n"])
      assert.equal(ConflictMarkers.has(text), true, text);
  });

  test("ignores marker-like text that isn't a whole marker at a line's start", () => {
    for (const text of ["", "plain\n", " <<<<<<< ours\n", "<<<<<<<< eight\n", "<<<<<<<x\n", "========\n", "======= not alone\n", "a <<<<<<< b\n", "<<<<<<"])
      assert.equal(ConflictMarkers.has(text), false, text);
  });
});
