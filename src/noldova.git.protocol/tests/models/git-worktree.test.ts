/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitWorktree } from "../../src/models/git-worktree.ts";

describe("GitWorktree", () => {
  const head = "a".repeat(40);

  it("keeps its folder, head, branch, lock and prune state, and reads back the same", () => {
    const worktree = new GitWorktree("C:/work/repo", head, "feature/view", true, false);

    assert.deepEqual(worktree.toJson(), { path: "C:/work/repo", head, branch: "feature/view", locked: true, prunable: false });
    assert.deepEqual(GitWorktree.fromJson(JSON.parse(JSON.stringify(worktree.toJson()))), worktree);
    assert.deepEqual(new GitWorktree("/srv/bare.git", null, null, false, true).toJson(), { path: "/srv/bare.git", head: null, branch: null, locked: false, prunable: true });
  });

  it("refuses a relative folder, a head that isn't an object id and a branch git refuses, naming its path", () => {
    assert.throws(() => new GitWorktree("repo", head, "main", false, false), { name: "ProtocolFieldException", field: "path" });
    assert.throws(() => new GitWorktree("/repo", "HEAD", "main", false, false), { name: "ProtocolFieldException", field: "head" });
    assert.throws(() => new GitWorktree("/repo", head, "-x", false, false), { name: "ProtocolFieldException", field: "branch" });
    assert.throws(() => GitWorktree.fromJson({ path: "/repo", head, branch: "a..b", locked: false, prunable: false }, "$.worktrees.1"), { name: "ProtocolFieldException", field: "$.worktrees.1.branch" });
  });

  it("refuses a missing field and an unknown one", () => {
    assert.throws(() => GitWorktree.fromJson({ path: "/repo", head, branch: null, locked: false }), { name: "JsonException", path: "$.prunable" });
    assert.throws(() => GitWorktree.fromJson({ path: "/repo", head, branch: null, locked: false, prunable: false, reason: "x" }), { name: "ProtocolFieldException", field: "$.reason" });
  });
});
