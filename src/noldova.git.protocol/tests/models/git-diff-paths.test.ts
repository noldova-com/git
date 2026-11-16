/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitDiffPaths } from "../../src/models/git-diff-paths.ts";

describe("GitDiffPaths", () => {
  it("keeps no paths, for every file, up to 10000", () => {
    assert.deepEqual(new GitDiffPaths([]).paths, []);
    assert.equal(new GitDiffPaths(Array.from({ length: 10000 }, (_, index) => `f${index}`)).paths.length, 10000);
    assert.throws(() => new GitDiffPaths(Array.from({ length: 10001 }, (_, index) => `f${index}`)),
      { name: "ProtocolFieldException", field: "paths", message: "The field paths is invalid: expected 0 to 10000 paths." });
  });

  it("refuses a path that isn't relative to the repository's top folder, naming it by its index", () => {
    assert.deepEqual(new GitDiffPaths(["a.txt", "src/b.ts"]).paths, ["a.txt", "src/b.ts"]);
    assert.throws(() => new GitDiffPaths(["a.txt", "../b.txt"]), { name: "ProtocolFieldException", field: "paths.1" });
    assert.throws(() => new GitDiffPaths(["/etc/passwd"]), { name: "ProtocolFieldException", field: "paths.0" });
    assert.throws(() => new GitDiffPaths([":(glob)*"]), { name: "ProtocolFieldException", field: "paths.0" });
  });
});
