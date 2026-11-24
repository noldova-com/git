/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { GitPickParams } from "../../src/models/git-pick-params.ts";

describe("GitPickParams", () => {
  const id = "0123456789abcdef0123456789abcdef01234567";

  it("keeps its folder, id and fingerprint, reads back the same, and refuses a relative folder, a short id, an empty fingerprint and an unknown field", () => {
    const params = new GitPickParams("/home/a/repo", id, "print");

    assert.deepEqual(params.toJson(), { folder: "/home/a/repo", id, basedOn: "print" });
    assert.deepEqual(GitPickParams.fromJson(params.toJson()), params);
    assert.throws(() => GitPickParams.fromJson({ folder: "repo", id, basedOn: "p" }), { name: "ProtocolFieldException", field: "$.folder" });
    assert.throws(() => GitPickParams.fromJson({ folder: "/home/a/repo", id: "-x", basedOn: "p" }), { name: "ProtocolFieldException", field: "$.id" });
    assert.throws(() => GitPickParams.fromJson({ folder: "/home/a/repo", id, basedOn: "" }), { name: "ProtocolFieldException", field: "$.basedOn" });
    assert.throws(() => GitPickParams.fromJson({ folder: "/home/a/repo", id, basedOn: "p", more: 1 }), { name: "ProtocolFieldException" });
  });
});
