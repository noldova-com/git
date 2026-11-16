/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { PathBatches } from "../../src/models/path-batches.ts";

describe("PathBatches", () => {
  test("keeps paths that fit one command line together, in order", () => {
    assert.deepEqual(PathBatches.split(["a.txt", "b/c.txt"]), [["a.txt", "b/c.txt"]]);
    assert.deepEqual(PathBatches.split([]), []);
  });

  test("starts a new batch before a path would pass 24,000 characters, counting each path's quotes", () => {
    const long = "p".repeat(3997);
    const paths = Array.from({ length: 13 }, (_, index) => `${long}${index.toString().padStart(3, "0")}`);

    const batches = PathBatches.split(paths);

    assert.deepEqual(batches.map(t => t.length), [5, 5, 3]);
    assert.deepEqual(batches.flat(), paths);
  });
});
