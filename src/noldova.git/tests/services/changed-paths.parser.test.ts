/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { describe, test } from "vitest";

import { ChangedPathsParser } from "../../src/services/changed-paths.parser.ts";

describe("ChangedPathsParser", () => {
  const ID = "0123456789abcdef0123456789abcdef01234567";
  const texts = (paths: Buffer[]): string[] => paths.map(t => t.toString("utf8"));

  test("reads each changed path once, skipping the original path of a rename in either column", () => {
    const output = Buffer.from([
      "# branch.oid (initial)",
      `1 .M N... 100644 100644 100644 ${ID} ${ID} a file.txt`,
      `2 R. N... 100644 100644 100644 ${ID} ${ID} R100 new name.txt`,
      "old name.txt",
      `2 .R N... 100644 100644 100644 ${ID} ${ID} R100 moved.txt`,
      "added.txt",
      `u UU N... 100644 100644 100644 100644 ${ID} ${ID} ${ID} both.txt`,
      "? untracked dir/new.txt",
      "! ignored.txt",
      ""
    ].join("\0"));

    assert.deepEqual(texts(ChangedPathsParser.parse(output)), ["a file.txt", "new name.txt", "moved.txt", "both.txt", "untracked dir/new.txt", "ignored.txt"]);
  });

  test("keeps paths as bytes, so names that aren't UTF-8 stay apart", () => {
    const output = Buffer.concat([Buffer.from("? "), Buffer.from([0xff]), Buffer.from("\0? "), Buffer.from([0xfe]), Buffer.from("\0")]);

    assert.deepEqual(ChangedPathsParser.parse(output), [Buffer.from([0xff]), Buffer.from([0xfe])]);
  });

  test("reads the last entry when the output doesn't end with a separator", () => {
    assert.deepEqual(texts(ChangedPathsParser.parse(Buffer.from("? a.txt\0? b.txt"))), ["a.txt", "b.txt"]);
  });

  test("reads nothing from a clean status", () => {
    assert.deepEqual(ChangedPathsParser.parse(Buffer.alloc(0)), []);
  });
});
