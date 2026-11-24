/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { GitBranchAtParams } from "../../src/models/git-branch-at-params.ts";

describe("GitBranchAtParams", () => {
  const id = "0123456789abcdef0123456789abcdef01234567";

  it("keeps its folder, name, commit and fingerprint, reads back the same, and refuses a bad name, a short id and an unknown field", () => {
    const params = new GitBranchAtParams("/home/a/repo", "fix/one", id, "print");

    assert.deepEqual(params.toJson(), { folder: "/home/a/repo", name: "fix/one", id, basedOn: "print" });
    assert.deepEqual(GitBranchAtParams.fromJson(params.toJson()), params);
    assert.throws(() => GitBranchAtParams.fromJson({ folder: "repo", name: "a", id, basedOn: "p" }), { name: "ProtocolFieldException", field: "$.folder" });
    assert.throws(() => GitBranchAtParams.fromJson({ folder: "/r", name: "-a", id, basedOn: "p" }), { name: "ProtocolFieldException", field: "$.name" });
    assert.throws(() => GitBranchAtParams.fromJson({ folder: "/r", name: "a", id: "01", basedOn: "p" }), { name: "ProtocolFieldException", field: "$.id" });
    assert.throws(() => GitBranchAtParams.fromJson({ folder: "/r", name: "a", id, basedOn: "" }), { name: "ProtocolFieldException", field: "$.basedOn" });
    assert.throws(() => GitBranchAtParams.fromJson({ folder: "/r", name: "a", id, basedOn: "p", more: 1 }), { name: "ProtocolFieldException" });
  });
});
