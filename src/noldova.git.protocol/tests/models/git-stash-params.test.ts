/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitStashParams } from "../../src/models/git-stash-params.ts";

describe("GitStashParams", () => {
  it("keeps its folder, message, untracked choice and fingerprint, and reads back the same", () => {
    const named = new GitStashParams("/repo", "Half-done lanes", true, "f1");
    const plain = new GitStashParams("/repo", null, false, "f1");

    assert.deepEqual([named.toJson(), plain.toJson()], [{ folder: "/repo", message: "Half-done lanes", includeUntracked: true, basedOn: "f1" },
      { folder: "/repo", message: null, includeUntracked: false, basedOn: "f1" }]);
    assert.deepEqual([GitStashParams.fromJson(JSON.parse(JSON.stringify(named.toJson()))), GitStashParams.fromJson(plain.toJson())], [named, plain]);
  });

  it("refuses a relative folder, an empty or multi-line message, an empty fingerprint, a missing field and an unknown one, naming its path", () => {
    assert.throws(() => new GitStashParams("repo", null, false, "f"), { name: "ProtocolFieldException", field: "folder" });
    assert.throws(() => new GitStashParams("/repo", "", false, "f"), { name: "ProtocolFieldException", field: "message" });
    assert.throws(() => GitStashParams.fromJson({ folder: "/repo", message: "a\nb", includeUntracked: false, basedOn: "f" }, "$.params"),
      { name: "ProtocolFieldException", field: "$.params.message" });
    assert.throws(() => new GitStashParams("/repo", null, false, ""), { name: "ProtocolFieldException", field: "basedOn" });
    assert.throws(() => GitStashParams.fromJson({ folder: "/repo", message: null, basedOn: "f" }), { name: "JsonException", path: "$.includeUntracked" });
    assert.throws(() => GitStashParams.fromJson({ folder: "/repo", message: null, includeUntracked: false, basedOn: "f", keep: true }),
      { name: "ProtocolFieldException", field: "$.keep" });
  });
});
