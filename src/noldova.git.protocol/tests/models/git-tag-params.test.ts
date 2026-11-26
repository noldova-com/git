/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitTagParams } from "../../src/models/git-tag-params.ts";

describe("GitTagParams", () => {
  it("keeps its parts, and reads back the same", () => {
    const params = new GitTagParams("/home/a/repo", "v1.2.0", "f1");

    assert.deepEqual(params.toJson(), { folder: "/home/a/repo", name: "v1.2.0", basedOn: "f1" });
    assert.deepEqual(GitTagParams.fromJson(JSON.parse(JSON.stringify(params.toJson()))), params);
  });

  it("refuses a part out of its range, a missing part and an unknown field, naming its path", () => {
    const json = new GitTagParams("/home/a/repo", "v1.2.0", "f1").toJson();
    assert.throws(() => GitTagParams.fromJson({ ...json, folder: "repo" }, "$.params"), { name: "ProtocolFieldException", field: "$.params.folder" });
    assert.throws(() => GitTagParams.fromJson({ ...json, name: "v1 2" }, "$.params"), { name: "ProtocolFieldException", field: "$.params.name" });
    assert.throws(() => GitTagParams.fromJson({ ...json, basedOn: "" }, "$.params"), { name: "ProtocolFieldException", field: "$.params.basedOn" });
    assert.throws(() => GitTagParams.fromJson({ ...json, folder: undefined }), { name: "JsonException", path: "$.folder" });
    assert.throws(() => GitTagParams.fromJson({ ...json, force: true }), { name: "ProtocolFieldException", field: "$.force" });
  });
});
