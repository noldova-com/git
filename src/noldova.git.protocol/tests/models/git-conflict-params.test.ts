/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitConflictParams } from "../../src/models/git-conflict-params.ts";

describe("GitConflictParams", () => {
  it("keeps its folder and path, and reads back the same", () => {
    const params = new GitConflictParams("/repo", "src/a.ts");

    assert.deepEqual(params.toJson(), { folder: "/repo", path: "src/a.ts" });
    assert.deepEqual(GitConflictParams.fromJson(JSON.parse(JSON.stringify(params.toJson()))), params);
  });

  it("refuses a relative folder, an absolute or climbing path and an unknown field, naming its path", () => {
    assert.throws(() => new GitConflictParams("repo", "a.ts"), { name: "ProtocolFieldException", field: "folder" });
    assert.throws(() => new GitConflictParams("/repo", "/a.ts"), { name: "ProtocolFieldException", field: "path" });
    assert.throws(() => GitConflictParams.fromJson({ folder: "/repo", path: "../a.ts" }, "$.params"), { name: "ProtocolFieldException", field: "$.params.path" });
    assert.throws(() => GitConflictParams.fromJson({ folder: "/repo" }), { name: "JsonException", path: "$.path" });
    assert.throws(() => GitConflictParams.fromJson({ folder: "/repo", path: "a.ts", basedOn: "f" }), { name: "ProtocolFieldException", field: "$.basedOn" });
  });
});
