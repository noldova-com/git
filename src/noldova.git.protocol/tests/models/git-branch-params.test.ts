/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitBranchParams } from "../../src/models/git-branch-params.ts";

describe("GitBranchParams", () => {
  it("keeps its folder, branch name and the fingerprint it is based on, and reads back the same", () => {
    const params = new GitBranchParams("/repo", "feature/view", "f1");

    assert.deepEqual(params.toJson(), { folder: "/repo", name: "feature/view", basedOn: "f1" });
    assert.deepEqual(GitBranchParams.fromJson(JSON.parse(JSON.stringify(params.toJson()))), params);
  });

  it("takes a branch name git accepts, of 1 to 255 characters, and refuses one git would read as an option", () => {
    const expected = { name: "ProtocolFieldException", field: "name", message: /^The field name is invalid: expected a branch name git accepts: 1 to 255 characters, not - first/ };

    assert.equal(new GitBranchParams("/repo", "b".repeat(255), "f").name.length, 255);
    for (const name of ["", "b".repeat(256), "-f", "--orphan=x", "a..b", "x.lock", "a b", "a~1"])
      assert.throws(() => new GitBranchParams("/repo", name, "f"), expected);
    assert.throws(() => GitBranchParams.fromJson({ folder: "/repo", name: "-f", basedOn: "f" }, "$.params"), { name: "ProtocolFieldException", field: "$.params.name" });
  });

  it("answers whether it takes a name without throwing, by the same rules", () => {
    const names: readonly string[] = ["feature/view", "b".repeat(255), "", "b".repeat(256), "-f", "@", "HEAD", "a..b", "a@{1", "a.", "a/.b", "a//b", "x.lock", "a b", "a~1"];

    assert.deepEqual(names.map(t => GitBranchParams.isBranchName(t)), [true, true, false, false, false, false, false, false, false, false, false, false, false, false, false]);
  });

  it("refuses a relative folder, an empty or missing fingerprint and an unknown field, naming its path", () => {
    assert.throws(() => new GitBranchParams("repo", "main", "f"), { name: "ProtocolFieldException", field: "folder" });
    assert.throws(() => new GitBranchParams("/repo", "main", ""), { name: "ProtocolFieldException", field: "basedOn" });
    assert.throws(() => GitBranchParams.fromJson({ folder: "/repo", name: "main" }), { name: "JsonException", path: "$.basedOn" });
    assert.throws(() => GitBranchParams.fromJson({ folder: "/repo", name: "main", basedOn: "f", force: true }), { name: "ProtocolFieldException", field: "$.force" });
  });
});
