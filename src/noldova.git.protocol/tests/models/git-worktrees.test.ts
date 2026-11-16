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
import { GitWorktrees } from "../../src/models/git-worktrees.ts";

describe("GitWorktrees", () => {
  it("keeps its worktrees in order, and reads back the same", () => {
    const worktrees = new GitWorktrees([new GitWorktree("/repo", null, "main", false, false), new GitWorktree("/repo-two", "b".repeat(64), null, false, true)]);

    assert.deepEqual(GitWorktrees.fromJson(JSON.parse(JSON.stringify(worktrees.toJson()))), worktrees);
    assert.deepEqual(new GitWorktrees([]).toJson(), { worktrees: [] });
  });

  it("refuses a worktree the protocol refuses, a missing field and an unknown one, naming its path", () => {
    assert.throws(() => GitWorktrees.fromJson({ worktrees: [{ path: "relative", head: null, branch: null, locked: false, prunable: false }] }), { name: "ProtocolFieldException", field: "$.worktrees.0.path" });
    assert.throws(() => GitWorktrees.fromJson({}), { name: "JsonException", path: "$.worktrees" });
    assert.throws(() => GitWorktrees.fromJson({ worktrees: [], more: true }), { name: "ProtocolFieldException", field: "$.more" });
  });
});
