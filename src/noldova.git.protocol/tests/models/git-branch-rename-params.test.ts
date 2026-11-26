/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitBranchRenameParams } from "../../src/models/git-branch-rename-params.ts";

describe("GitBranchRenameParams", () => {
  it("keeps its parts, and reads back the same", () => {
    const params = new GitBranchRenameParams("/home/a/repo", "feature/old", "feature/new", "f1");

    assert.deepEqual(params.toJson(), { folder: "/home/a/repo", name: "feature/old", newName: "feature/new", basedOn: "f1" });
    assert.deepEqual(GitBranchRenameParams.fromJson(JSON.parse(JSON.stringify(params.toJson()))), params);
  });

  it("refuses a part out of its range, a missing part and an unknown field, naming its path", () => {
    const json = new GitBranchRenameParams("/home/a/repo", "feature/old", "feature/new", "f1").toJson();
    assert.throws(() => GitBranchRenameParams.fromJson({ ...json, folder: "repo" }, "$.params"), { name: "ProtocolFieldException", field: "$.params.folder" });
    assert.throws(() => GitBranchRenameParams.fromJson({ ...json, name: "-x" }, "$.params"), { name: "ProtocolFieldException", field: "$.params.name" });
    assert.throws(() => GitBranchRenameParams.fromJson({ ...json, newName: "a..b" }, "$.params"), { name: "ProtocolFieldException", field: "$.params.newName" });
    assert.throws(() => GitBranchRenameParams.fromJson({ ...json, basedOn: "" }, "$.params"), { name: "ProtocolFieldException", field: "$.params.basedOn" });
    assert.throws(() => GitBranchRenameParams.fromJson({ ...json, folder: undefined }), { name: "JsonException", path: "$.folder" });
    assert.throws(() => GitBranchRenameParams.fromJson({ ...json, force: true }), { name: "ProtocolFieldException", field: "$.force" });
  });
});
