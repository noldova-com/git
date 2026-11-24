/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitOperationParams } from "../../src/models/git-operation-params.ts";

describe("GitOperationParams", () => {
  it("keeps its folder and the fingerprint it is based on, and reads back the same", () => {
    const params = new GitOperationParams("/repo", "f1");

    assert.deepEqual(params.toJson(), { folder: "/repo", basedOn: "f1" });
    assert.deepEqual(GitOperationParams.fromJson(JSON.parse(JSON.stringify(params.toJson()))), params);
  });

  it("refuses a relative folder, an empty or missing fingerprint and an unknown field, naming its path", () => {
    assert.throws(() => new GitOperationParams("repo", "f"), { name: "ProtocolFieldException", field: "folder" });
    assert.throws(() => new GitOperationParams("/repo", ""), { name: "ProtocolFieldException", field: "basedOn" });
    assert.throws(() => GitOperationParams.fromJson({ folder: "/repo", basedOn: "" }, "$.params"), { name: "ProtocolFieldException", field: "$.params.basedOn" });
    assert.throws(() => GitOperationParams.fromJson({ folder: "/repo" }), { name: "JsonException", path: "$.basedOn" });
    assert.throws(() => GitOperationParams.fromJson({ folder: "/repo", basedOn: "f", kind: "Merge" }), { name: "ProtocolFieldException", field: "$.kind" });
  });
});
