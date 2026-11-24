/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitBranchTrack, GitRemoteTracks } from "../../src/api/index.ts";

describe("GitRemoteTracks", () => {
  it("keeps how far each remote branch is from HEAD, and reads back the same", () => {
    const remote = new GitRemoteTracks([new GitBranchTrack("origin/feature/x", 2, 0), new GitBranchTrack("upstream/main", 0, 5)]);

    assert.deepEqual(remote.toJson(), { tracks: [{ branch: "origin/feature/x", ahead: 2, behind: 0 }, { branch: "upstream/main", ahead: 0, behind: 5 }] });
    assert.deepEqual(GitRemoteTracks.fromJson(JSON.parse(JSON.stringify(remote.toJson()))), remote);
    assert.deepEqual(new GitRemoteTracks([]).toJson(), { tracks: [] });
  });

  it("refuses a branch that isn't a remote branch's name, one named twice, a track it can't read and an unknown field, naming its path", () => {
    assert.throws(() => new GitRemoteTracks([new GitBranchTrack("-origin/main", 1, 0)]), { name: "ProtocolFieldException", field: "tracks.0" });
    assert.throws(() => new GitRemoteTracks([new GitBranchTrack("origin/main", 1, 0), new GitBranchTrack("origin/main", 0, 1)]),
      { name: "ProtocolFieldException", field: "tracks.1" });
    assert.throws(() => GitRemoteTracks.fromJson({ tracks: [{ branch: "origin/.hidden", ahead: 1, behind: 0 }] }), { name: "ProtocolFieldException", field: "$.tracks.0" });
    assert.throws(() => GitRemoteTracks.fromJson({ tracks: [{ branch: "origin/main", ahead: -1, behind: 0 }] }), { name: "ProtocolFieldException", field: "$.tracks.0.ahead" });
    assert.throws(() => GitRemoteTracks.fromJson({}), { name: "JsonException", path: "$.tracks" });
    assert.throws(() => GitRemoteTracks.fromJson({ tracks: [], base: null }), { name: "ProtocolFieldException", field: "$.base" });
  });
});
