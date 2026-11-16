/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitBranches } from "../../src/models/git-branches.ts";

describe("GitBranches", () => {
  it("keeps the current branch, the local branches, the remotes and their branches, and reads back the same", () => {
    const branches = new GitBranches("main", ["feature/view", "main"], ["origin", "upstream"], ["origin/main", "upstream/feat/4321-provider-menu"]);

    assert.deepEqual(branches.toJson(), {
      current: "main", branches: ["feature/view", "main"], remotes: ["origin", "upstream"], remoteBranches: ["origin/main", "upstream/feat/4321-provider-menu"]
    });
    assert.deepEqual(GitBranches.fromJson(JSON.parse(JSON.stringify(branches.toJson()))), branches);
  });

  it("a detached HEAD has no current branch, and a repository with no commits may have no branches and no remotes", () => {
    const detached = new GitBranches(null, ["main"], ["origin"], ["origin/main"]);
    const unborn = new GitBranches("main", [], [], []);

    assert.deepEqual(GitBranches.fromJson(detached.toJson()), detached);
    assert.deepEqual(GitBranches.fromJson(unborn.toJson()), unborn);
  });

  it("refuses an empty current branch, an empty or non-text branch or remote, a remote branch git refuses and an unknown field, naming its path", () => {
    assert.throws(() => new GitBranches("", [], [], []), { name: "ProtocolFieldException", field: "current" });
    assert.throws(() => new GitBranches("main", ["main", ""], [], []), { name: "ProtocolFieldException", field: "branches.1" });
    assert.throws(() => new GitBranches("main", ["main"], ["origin", ""], []), { name: "ProtocolFieldException", field: "remotes.1" });
    for (const name of ["", "-origin/main", "origin//main", "origin/main.lock", "origin/a..b", "origin/a b"])
      assert.throws(() => new GitBranches("main", [], ["origin"], ["origin/main", name]), { name: "ProtocolFieldException", field: "remoteBranches.1" });
    assert.throws(() => GitBranches.fromJson({ current: null, branches: ["main", ""], remotes: [], remoteBranches: [] }), { name: "ProtocolFieldException", field: "$.branches.1" });
    assert.throws(() => GitBranches.fromJson({ current: null, branches: [1], remotes: [], remoteBranches: [] }), { name: "JsonException", path: "$.branches.0" });
    assert.throws(() => GitBranches.fromJson({ current: null, branches: [], remotes: [""], remoteBranches: [] }), { name: "ProtocolFieldException", field: "$.remotes.0" });
    assert.throws(() => GitBranches.fromJson({ current: null, branches: [], remotes: [true], remoteBranches: [] }), { name: "JsonException", path: "$.remotes.0" });
    assert.throws(() => GitBranches.fromJson({ current: null, branches: [], remotes: [], remoteBranches: ["origin/x~1"] }), { name: "ProtocolFieldException", field: "$.remoteBranches.0" });
    assert.throws(() => GitBranches.fromJson({ current: null, remotes: [], remoteBranches: [] }), { name: "JsonException", path: "$.branches" });
    assert.throws(() => GitBranches.fromJson({ current: null, branches: [], remoteBranches: [] }), { name: "JsonException", path: "$.remotes" });
    assert.throws(() => GitBranches.fromJson({ current: null, branches: [], remotes: [] }), { name: "JsonException", path: "$.remoteBranches" });
    assert.throws(() => GitBranches.fromJson({ current: null, branches: [], remotes: [], remoteBranches: [], tags: [] }), { name: "ProtocolFieldException", field: "$.tags" });
  });
});
