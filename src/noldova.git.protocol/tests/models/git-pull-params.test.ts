/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitPullParams } from "../../src/models/git-pull-params.ts";

describe("GitPullParams", () => {
  it("keeps its folder and the fingerprint it is based on, and reads back the same", () => {
    const params = new GitPullParams("/repo", "f1");

    assert.deepEqual(params.toJson(), { folder: "/repo", basedOn: "f1" });
    assert.deepEqual(GitPullParams.fromJson(JSON.parse(JSON.stringify(params.toJson()))), params);
  });

  it("refuses a relative folder, an empty or missing fingerprint and an unknown field, naming its path", () => {
    assert.throws(() => new GitPullParams("repo", "f"), { name: "ProtocolFieldException", field: "folder" });
    assert.throws(() => new GitPullParams("/repo", ""), { name: "ProtocolFieldException", field: "basedOn" });
    assert.throws(() => GitPullParams.fromJson({ folder: "/repo", basedOn: "" }, "$.params"), { name: "ProtocolFieldException", field: "$.params.basedOn" });
    assert.throws(() => GitPullParams.fromJson({ folder: "/repo" }), { name: "JsonException", path: "$.basedOn" });
    assert.throws(() => GitPullParams.fromJson({ folder: "/repo", basedOn: "f", force: true }), { name: "ProtocolFieldException", field: "$.force" });
  });
});
