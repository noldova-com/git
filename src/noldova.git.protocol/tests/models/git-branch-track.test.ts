/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitBranchTrack } from "../../src/models/git-branch-track.ts";

describe("GitBranchTrack", () => {
  it("keeps the branch and how far ahead and behind it is, and reads back the same", () => {
    const track = new GitBranchTrack("feature/view", 3, 1);

    assert.deepEqual(track.toJson(), { branch: "feature/view", ahead: 3, behind: 1 });
    assert.deepEqual(GitBranchTrack.fromJson(JSON.parse(JSON.stringify(track.toJson()))), track);
  });

  it("refuses an empty branch, a count that isn't a whole number of 0 or more and an unknown field, naming its path", () => {
    assert.throws(() => new GitBranchTrack("", 0, 0), { name: "ProtocolFieldException", field: "branch" });
    assert.throws(() => new GitBranchTrack("main", -1, 0), { name: "ProtocolFieldException", field: "ahead" });
    assert.throws(() => new GitBranchTrack("main", 0, 1.5), { name: "ProtocolFieldException", field: "behind" });
    assert.throws(() => GitBranchTrack.fromJson({ branch: "main", ahead: 0, behind: -2 }), { name: "ProtocolFieldException", field: "$.behind" });
    assert.throws(() => GitBranchTrack.fromJson({ branch: "main", ahead: 0 }), { name: "JsonException", path: "$.behind" });
    assert.throws(() => GitBranchTrack.fromJson({ branch: "main", ahead: 0, behind: 0, gone: false }), { name: "ProtocolFieldException", field: "$.gone" });
  });
});
