/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { LfsPointer } from "../../src/models/lfs-pointer.ts";

describe("LfsPointer", () => {
  const oid = "a".repeat(64);

  test("reads a pointer's SHA-256 and size, past any extension lines", () => {
    const pointer = LfsPointer.parse(Buffer.from(`version https://git-lfs.github.com/spec/v1\next-0-tool sha256:${"b".repeat(64)}\noid sha256:${oid}\nsize 12345\n`));

    assert.deepEqual([pointer?.oid, pointer?.size], [oid, 12345]);
  });

  test("refuses a blob that isn't a pointer: another first line, no oid, no size, or an oid that isn't SHA-256", () => {
    const blobs = [
      `hello\noid sha256:${oid}\nsize 1\n`,
      "version https://git-lfs.github.com/spec/v1\nsize 1\n",
      `version https://git-lfs.github.com/spec/v1\noid sha256:${oid}\n`,
      "version https://git-lfs.github.com/spec/v1\noid sha1:abc\nsize 1\n"
    ];

    assert.deepEqual(blobs.map(t => LfsPointer.parse(Buffer.from(t))), [null, null, null, null]);
  });
});
