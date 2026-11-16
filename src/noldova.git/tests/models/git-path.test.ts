/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { TextDecoder } from "node:util";

import { describe, onTestFinished, test, vi } from "vitest";

import { GitPath } from "../../src/models/git-path.ts";

describe("GitPath", () => {
  test("reads a UTF-8 path as text alone, keeping a leading byte order mark", () => {
    assert.deepEqual({ ...GitPath.fromBytes(Buffer.from("﻿dir/Æø.txt")) }, { text: "﻿dir/Æø.txt", bytes: undefined });
  });

  test("keeps a path that isn't UTF-8 as its bytes in base64, beside a text with the invalid byte replaced", () => {
    const bytes = Buffer.from([0x61, 0xff, 0x62]);

    assert.deepEqual({ ...GitPath.fromBytes(bytes) }, { text: "a�b", bytes: "Yf9i" });
  });

  test("lets through a failure to decode other than bytes that aren't UTF-8", () => {
    const failure = new RangeError("The decoder broke.");
    const decode = vi.spyOn(TextDecoder.prototype, "decode").mockImplementationOnce(() => {
      throw failure;
    });
    onTestFinished(() => decode.mockRestore());

    assert.throws(() => GitPath.fromBytes(Buffer.from("a.txt")), failure);
  });

  test("gives a path's bytes from its base64 bytes when it has them, else from its text", () => {
    assert.deepEqual(GitPath.toBytes("a�b", "Yf9i"), Buffer.from([0x61, 0xff, 0x62]));
    assert.deepEqual(GitPath.toBytes("Æ.txt", undefined), Buffer.from("Æ.txt"));
  });

  test("carries the text and bytes it is given", () => {
    assert.deepEqual({ ...new GitPath("a", "YQ==") }, { text: "a", bytes: "YQ==" });
  });
});
