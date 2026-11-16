/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { describe, test } from "vitest";

import { ChangedPaths } from "../../src/models/changed-paths.ts";

describe("ChangedPaths", () => {
  test("is empty only with no paths and nothing cut", () => {
    assert.equal(new ChangedPaths([], false, "d").isEmpty, true);
    assert.equal(new ChangedPaths([], true, "d").isEmpty, false);
    assert.equal(new ChangedPaths(["a"], false, "d").isEmpty, false);
  });

  test("carries the listed paths, whether the list was cut, and the digest of every change", () => {
    assert.deepEqual({ ...new ChangedPaths(["a"], true, "d") }, { paths: ["a"], isTruncated: true, digest: "d" });
  });

  test("equals exactly the changes with the same digest, which binds every path and its content", () => {
    const changes = new ChangedPaths(["a"], false, "d");

    assert.equal(changes.equals(new ChangedPaths(["a"], false, "d")), true);
    assert.equal(changes.equals(new ChangedPaths(["a"], false, "e")), false);
  });
});
