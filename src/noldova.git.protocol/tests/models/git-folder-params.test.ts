/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitFolderParams } from "../../src/models/git-folder-params.ts";

describe("GitFolderParams", () => {
  it("keeps its folder, and reads back the same", () => {
    const params = new GitFolderParams("C:\\work\\repo");

    assert.deepEqual(params.toJson(), { folder: "C:\\work\\repo" });
    assert.deepEqual(GitFolderParams.fromJson(JSON.parse(JSON.stringify(params.toJson()))), params);
  });

  it("refuses a relative folder, a missing folder and an unknown field, naming its path", () => {
    assert.throws(() => new GitFolderParams("repo"), { name: "ProtocolFieldException", field: "folder", message: "The field folder is invalid: expected an absolute path of at most 4096 characters." });
    assert.throws(() => GitFolderParams.fromJson({ folder: "" }, "$.params"), { name: "ProtocolFieldException", field: "$.params.folder" });
    assert.throws(() => GitFolderParams.fromJson({}), { name: "JsonException", path: "$.folder" });
    assert.throws(() => GitFolderParams.fromJson({ folder: "/repo", depth: 1 }), { name: "ProtocolFieldException", field: "$.depth" });
  });
});
