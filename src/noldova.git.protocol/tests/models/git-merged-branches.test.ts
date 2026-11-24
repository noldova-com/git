/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitMergedBranches } from "../../src/api/index.ts";

describe("GitMergedBranches", () => {
  it("keeps the remote branch a remote's HEAD names and the local branches merged into it, and reads back the same", () => {
    const merged = new GitMergedBranches("origin/main", ["main", "fix/old"]);

    assert.deepEqual(merged.toJson(), { base: "origin/main", branches: ["main", "fix/old"] });
    assert.deepEqual(GitMergedBranches.fromJson(JSON.parse(JSON.stringify(merged.toJson()))), merged);
    assert.deepEqual(new GitMergedBranches(null, []).toJson(), { base: null, branches: [] });
  });

  it("refuses branches without a base, a base that isn't a branch name, an empty branch and an unknown field, naming its path", () => {
    assert.throws(() => new GitMergedBranches(null, ["main"]), { name: "ProtocolFieldException", field: "branches" });
    assert.throws(() => new GitMergedBranches("-origin/main", []), { name: "ProtocolFieldException", field: "base" });
    assert.throws(() => new GitMergedBranches("origin/main", ["main", ""]), { name: "ProtocolFieldException", field: "branches.1" });
    assert.throws(() => GitMergedBranches.fromJson({ base: "origin/main", branches: [""] }), { name: "ProtocolFieldException", field: "$.branches.0" });
    assert.throws(() => GitMergedBranches.fromJson({ base: "origin/main" }), { name: "JsonException", path: "$.branches" });
    assert.throws(() => GitMergedBranches.fromJson({ base: null, branches: [], truncated: false }), { name: "ProtocolFieldException", field: "$.truncated" });
  });
});
