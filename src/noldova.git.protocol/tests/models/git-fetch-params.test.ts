/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitFetchParams } from "../../src/models/git-fetch-params.ts";

describe("GitFetchParams", () => {
  it("keeps its folder and the fingerprint it is based on, and reads back the same", () => {
    const params = new GitFetchParams("/repo", "f1");

    assert.deepEqual(params.toJson(), { folder: "/repo", basedOn: "f1" });
    assert.deepEqual(GitFetchParams.fromJson(JSON.parse(JSON.stringify(params.toJson()))), params);
  });

  it("fetches every remote only when asked, leaving the field out otherwise, and reads a missing field as false", () => {
    const all = new GitFetchParams("/repo", "f1", true);

    assert.deepEqual([all.toJson(), new GitFetchParams("/repo", "f1", false).toJson()], [{ folder: "/repo", basedOn: "f1", allRemotes: true }, { folder: "/repo", basedOn: "f1" }]);
    assert.deepEqual([GitFetchParams.fromJson(all.toJson()).allRemotes, GitFetchParams.fromJson({ folder: "/repo", basedOn: "f1", allRemotes: false }).allRemotes,
      GitFetchParams.fromJson({ folder: "/repo", basedOn: "f1" }).allRemotes], [true, false, false]);
  });

  it("refuses a relative folder, an empty or missing fingerprint and an unknown field, naming its path", () => {
    assert.throws(() => new GitFetchParams("repo", "f"), { name: "ProtocolFieldException", field: "folder" });
    assert.throws(() => new GitFetchParams("/repo", ""), { name: "ProtocolFieldException", field: "basedOn" });
    assert.throws(() => GitFetchParams.fromJson({ folder: "/repo", basedOn: "" }, "$.params"), { name: "ProtocolFieldException", field: "$.params.basedOn" });
    assert.throws(() => GitFetchParams.fromJson({ folder: "/repo" }), { name: "JsonException", path: "$.basedOn" });
    assert.throws(() => GitFetchParams.fromJson({ folder: "/repo", basedOn: "f", force: true }), { name: "ProtocolFieldException", field: "$.force" });
    assert.throws(() => GitFetchParams.fromJson({ folder: "/repo", basedOn: "f", allRemotes: "yes" }), { name: "JsonException", path: "$.allRemotes" });
  });
});
