/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitLogParams } from "../../src/models/git-log-params.ts";

describe("GitLogParams", () => {
  it("keeps its folder and limit, and reads back the same", () => {
    const params = new GitLogParams("/repo", 50);

    assert.deepEqual(params.toJson(), { folder: "/repo", limit: 50 });
    assert.deepEqual(GitLogParams.fromJson(JSON.parse(JSON.stringify(params.toJson()))), params);
  });

  it("takes a limit from 1 to 500", () => {
    const expected = { name: "ProtocolFieldException", field: "limit", message: "The field limit is invalid: expected a whole number from 1 to 500." };

    assert.equal(new GitLogParams("/repo", 1).limit, 1);
    assert.equal(new GitLogParams("/repo", 500).limit, 500);
    for (const limit of [0, 501, 1.5, Number.NaN])
      assert.throws(() => new GitLogParams("/repo", limit), expected);
    assert.throws(() => GitLogParams.fromJson({ folder: "/repo", limit: 0 }, "$.params"), { name: "ProtocolFieldException", field: "$.params.limit" });
    assert.throws(() => GitLogParams.fromJson({ folder: "/repo", limit: 2.5 }), { name: "JsonException", path: "$.limit" });
  });

  it("refuses a relative folder, a missing limit and an unknown field, naming its path", () => {
    assert.throws(() => new GitLogParams("repo", 10), { name: "ProtocolFieldException", field: "folder" });
    assert.throws(() => GitLogParams.fromJson({ folder: "/repo" }), { name: "JsonException", path: "$.limit" });
    assert.throws(() => GitLogParams.fromJson({ folder: "/repo", limit: 10, skip: 0 }), { name: "ProtocolFieldException", field: "$.skip" });
  });
});
