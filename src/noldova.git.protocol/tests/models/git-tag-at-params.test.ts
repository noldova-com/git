/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitTagAtParams } from "../../src/models/git-tag-at-params.ts";

describe("GitTagAtParams", () => {
  it("keeps its parts, and reads back the same", () => {
    const params = new GitTagAtParams("/home/a/repo", "v1.2.0", "0123456789abcdef0123456789abcdef01234567", "f1");

    assert.deepEqual(params.toJson(), { folder: "/home/a/repo", name: "v1.2.0", id: "0123456789abcdef0123456789abcdef01234567", basedOn: "f1" });
    assert.deepEqual(GitTagAtParams.fromJson(JSON.parse(JSON.stringify(params.toJson()))), params);
  });

  it("refuses a part out of its range, a missing part and an unknown field, naming its path", () => {
    const json = new GitTagAtParams("/home/a/repo", "v1.2.0", "0123456789abcdef0123456789abcdef01234567", "f1").toJson();
    assert.throws(() => GitTagAtParams.fromJson({ ...json, folder: "repo" }, "$.params"), { name: "ProtocolFieldException", field: "$.params.folder" });
    assert.throws(() => GitTagAtParams.fromJson({ ...json, name: "HEAD" }, "$.params"), { name: "ProtocolFieldException", field: "$.params.name" });
    assert.throws(() => GitTagAtParams.fromJson({ ...json, id: "abc" }, "$.params"), { name: "ProtocolFieldException", field: "$.params.id" });
    assert.throws(() => GitTagAtParams.fromJson({ ...json, basedOn: "" }, "$.params"), { name: "ProtocolFieldException", field: "$.params.basedOn" });
    assert.throws(() => GitTagAtParams.fromJson({ ...json, folder: undefined }), { name: "JsonException", path: "$.folder" });
    assert.throws(() => GitTagAtParams.fromJson({ ...json, force: true }), { name: "ProtocolFieldException", field: "$.force" });
  });
});
