/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { ResetMode } from "../../src/enums/reset-mode.ts";
import { GitForcePushParams } from "../../src/models/git-force-push-params.ts";
import { GitResetParams } from "../../src/models/git-reset-params.ts";
import { GitUndoCommitParams } from "../../src/models/git-undo-commit-params.ts";
import { GitUndoParams } from "../../src/models/git-undo-params.ts";

describe("GitUndoParams", () => {
  it("keeps its folder, entry id and fingerprint, reads back the same, and refuses a relative folder, an empty or broken id, an empty fingerprint and an unknown field", () => {
    const params = new GitUndoParams("/home/a/repo", "7", "print");

    assert.deepEqual(params.toJson(), { folder: "/home/a/repo", id: "7", basedOn: "print" });
    assert.deepEqual(GitUndoParams.fromJson(params.toJson()), params);
    assert.throws(() => GitUndoParams.fromJson({ folder: "repo", id: "7", basedOn: "p" }), { name: "ProtocolFieldException", field: "$.folder" });
    assert.throws(() => GitUndoParams.fromJson({ folder: "/home/a/repo", id: "", basedOn: "p" }), { name: "ProtocolFieldException", field: "$.id" });
    assert.throws(() => GitUndoParams.fromJson({ folder: "/home/a/repo", id: "7\n", basedOn: "p" }), { name: "ProtocolFieldException", field: "$.id" });
    assert.throws(() => GitUndoParams.fromJson({ folder: "/home/a/repo", id: "7", basedOn: "" }), { name: "ProtocolFieldException", field: "$.basedOn" });
    assert.throws(() => GitUndoParams.fromJson({ folder: "/home/a/repo", id: "7", basedOn: "p", more: 1 }), { name: "ProtocolFieldException" });
  });
});

describe("GitResetParams", () => {
  const id = "0123456789abcdef0123456789abcdef01234567";

  it("keeps its folder, commit, mode and fingerprint, reads back the same, and refuses each field broken and an unknown field", () => {
    const params = new GitResetParams("/home/a/repo", id, ResetMode.Keep, "print");

    assert.deepEqual(params.toJson(), { folder: "/home/a/repo", id, mode: "Keep", basedOn: "print" });
    assert.deepEqual(GitResetParams.fromJson(params.toJson()), params);
    assert.throws(() => GitResetParams.fromJson({ folder: "repo", id, mode: "Soft", basedOn: "p" }), { name: "ProtocolFieldException", field: "$.folder" });
    assert.throws(() => GitResetParams.fromJson({ folder: "/home/a/repo", id: "HEAD~1", mode: "Soft", basedOn: "p" }), { name: "ProtocolFieldException", field: "$.id" });
    assert.throws(() => GitResetParams.fromJson({ folder: "/home/a/repo", id, mode: "Hard", basedOn: "p" }), { name: "JsonException", path: "$.mode" });
    assert.throws(() => new GitResetParams("/home/a/repo", id, "Hard" as ResetMode, "p"), { name: "ProtocolFieldException", field: "mode" });
    assert.throws(() => GitResetParams.fromJson({ folder: "/home/a/repo", id, mode: "Soft", basedOn: "" }), { name: "ProtocolFieldException", field: "$.basedOn" });
    assert.throws(() => GitResetParams.fromJson({ folder: "/home/a/repo", id, mode: "Soft", basedOn: "p", more: 1 }), { name: "ProtocolFieldException" });
  });
});

describe("GitUndoCommitParams", () => {
  it("keeps its folder and fingerprint, reads back the same, and refuses a relative folder, an empty fingerprint and an unknown field", () => {
    const params = new GitUndoCommitParams("/home/a/repo", "print");

    assert.deepEqual(params.toJson(), { folder: "/home/a/repo", basedOn: "print" });
    assert.deepEqual(GitUndoCommitParams.fromJson(params.toJson()), params);
    assert.throws(() => GitUndoCommitParams.fromJson({ folder: "repo", basedOn: "p" }), { name: "ProtocolFieldException", field: "$.folder" });
    assert.throws(() => GitUndoCommitParams.fromJson({ folder: "/home/a/repo", basedOn: "" }), { name: "ProtocolFieldException", field: "$.basedOn" });
    assert.throws(() => GitUndoCommitParams.fromJson({ folder: "/home/a/repo", basedOn: "p", more: 1 }), { name: "ProtocolFieldException" });
  });
});

describe("GitForcePushParams", () => {
  const expected = "0123456789abcdef0123456789abcdef01234567";

  it("keeps its folder, the commit the person saw and the fingerprint, reads back the same, and refuses each field broken and an unknown field", () => {
    const params = new GitForcePushParams("/home/a/repo", expected, "print");

    assert.deepEqual(params.toJson(), { folder: "/home/a/repo", expected, basedOn: "print" });
    assert.deepEqual(GitForcePushParams.fromJson(params.toJson()), params);
    assert.throws(() => GitForcePushParams.fromJson({ folder: "repo", expected, basedOn: "p" }), { name: "ProtocolFieldException", field: "$.folder" });
    assert.throws(() => GitForcePushParams.fromJson({ folder: "/home/a/repo", expected: "origin/main", basedOn: "p" }), { name: "ProtocolFieldException", field: "$.expected" });
    assert.throws(() => GitForcePushParams.fromJson({ folder: "/home/a/repo", expected, basedOn: "" }), { name: "ProtocolFieldException", field: "$.basedOn" });
    assert.throws(() => GitForcePushParams.fromJson({ folder: "/home/a/repo", expected, basedOn: "p", more: 1 }), { name: "ProtocolFieldException" });
  });
});
