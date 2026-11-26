/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitBranchTip } from "../../src/models/git-branch-tip.ts";
import { GitBranchTrack } from "../../src/models/git-branch-track.ts";
import { GitBranches } from "../../src/models/git-branches.ts";

describe("GitBranches", () => {
  it("keeps the current branch, the local branches, the remotes and their branches, and reads back the same", () => {
    const branches = new GitBranches("main", ["feature/view", "main"], ["origin", "upstream"], ["origin/main", "upstream/feat/4321-provider-menu"]);

    assert.deepEqual(branches.toJson(), {
      current: "main", branches: ["feature/view", "main"], remotes: ["origin", "upstream"], remoteBranches: ["origin/main", "upstream/feat/4321-provider-menu"], tracks: [],
      tips: []
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
    assert.throws(() => GitBranches.fromJson({ current: null, branches: ["main", ""], remotes: [], remoteBranches: [], tracks: [], tips: [] }), { name: "ProtocolFieldException", field: "$.branches.1" });
    assert.throws(() => GitBranches.fromJson({ current: null, branches: [1], remotes: [], remoteBranches: [], tracks: [], tips: [] }), { name: "JsonException", path: "$.branches.0" });
    assert.throws(() => GitBranches.fromJson({ current: null, branches: [], remotes: [""], remoteBranches: [], tracks: [], tips: [] }), { name: "ProtocolFieldException", field: "$.remotes.0" });
    assert.throws(() => GitBranches.fromJson({ current: null, branches: [], remotes: [true], remoteBranches: [], tracks: [], tips: [] }), { name: "JsonException", path: "$.remotes.0" });
    assert.throws(() => GitBranches.fromJson({ current: null, branches: [], remotes: [], remoteBranches: ["origin/x~1"], tracks: [], tips: [] }), { name: "ProtocolFieldException", field: "$.remoteBranches.0" });
    assert.throws(() => GitBranches.fromJson({ current: null, remotes: [], remoteBranches: [], tracks: [], tips: [] }), { name: "JsonException", path: "$.branches" });
    assert.throws(() => GitBranches.fromJson({ current: null, branches: [], remoteBranches: [], tracks: [], tips: [] }), { name: "JsonException", path: "$.remotes" });
    assert.throws(() => GitBranches.fromJson({ current: null, branches: [], remotes: [], tracks: [], tips: [] }), { name: "JsonException", path: "$.remoteBranches" });
    assert.throws(() => GitBranches.fromJson({ current: null, branches: [], remotes: [], remoteBranches: [], tags: [], tracks: [], tips: [] }), { name: "ProtocolFieldException", field: "$.tags" });
  });
  it("keeps how far branches are from their upstreams, reads them back, and refuses a track that names no local branch", () => {
    const branches = new GitBranches("main", ["main", "fix"], ["origin"], ["origin/main"], [new GitBranchTrack("main", 2, 0), new GitBranchTrack("fix", 0, 3)]);

    assert.deepEqual(branches.toJson()["tracks"], [{ branch: "main", ahead: 2, behind: 0 }, { branch: "fix", ahead: 0, behind: 3 }]);
    assert.deepEqual(GitBranches.fromJson(JSON.parse(JSON.stringify(branches.toJson()))), branches);
    assert.throws(() => new GitBranches("main", ["main"], [], [], [new GitBranchTrack("gone", 1, 0)]), { name: "ProtocolFieldException", field: "tracks.0" });
    assert.throws(() => GitBranches.fromJson({ current: null, branches: ["main"], remotes: [], remoteBranches: [], tracks: [{ branch: "main", ahead: 0, behind: 0 }, { branch: "x", ahead: 1, behind: 0 }], tips: [] }),
      { name: "ProtocolFieldException", field: "$.tracks.1" });
    assert.throws(() => GitBranches.fromJson({ current: null, branches: [], remotes: [], remoteBranches: [] }), { name: "JsonException", path: "$.tracks" });
  });

  it("keeps the commit each local branch points at, reads them back, and refuses a tip that names no local branch or a branch twice", () => {
    const main = "0123456789abcdef0123456789abcdef01234567";
    const fix = "89abcdef0123456789abcdef0123456789abcdef";
    const branches = new GitBranches("main", ["main", "fix"], [], [], [], [new GitBranchTip("main", main, "2026-11-23T10:00:00+01:00"), new GitBranchTip("fix", fix, "2026-11-23T10:00:00+01:00")]);

    assert.deepEqual(branches.toJson()["tips"], [{ branch: "main", id: main, committedAt: "2026-11-23T10:00:00+01:00" }, { branch: "fix", id: fix, committedAt: "2026-11-23T10:00:00+01:00" }]);
    assert.deepEqual(GitBranches.fromJson(JSON.parse(JSON.stringify(branches.toJson()))), branches);
    assert.throws(() => new GitBranches("main", ["main"], [], [], [], [new GitBranchTip("gone", main, "2026-11-23T10:00:00+01:00")]),
      { name: "ProtocolFieldException", field: "tips.0", message: "The field tips.0 is invalid: expected one of the local branches, each once." });
    assert.throws(() => new GitBranches("main", ["main"], [], [], [], [new GitBranchTip("main", main, "2026-11-23T10:00:00+01:00"), new GitBranchTip("main", fix, "2026-11-23T10:00:00+01:00")]),
      { name: "ProtocolFieldException", field: "tips.1" });
    assert.throws(() => GitBranches.fromJson({ current: null, branches: ["main"], remotes: [], remoteBranches: [], tracks: [], tips: [{ branch: "main", id: "x", committedAt: "2026-11-23T10:00:00+01:00" }] }),
      { name: "ProtocolFieldException", field: "$.tips.0.id" });
    assert.throws(() => GitBranches.fromJson({ current: null, branches: [], remotes: [], remoteBranches: [], tracks: [] }), { name: "JsonException", path: "$.tips" });
  });
});
