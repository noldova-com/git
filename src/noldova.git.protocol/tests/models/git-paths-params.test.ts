/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitPathsParams } from "../../src/models/git-paths-params.ts";

describe("GitPathsParams", () => {
  it("keeps its folder, paths and the fingerprint it is based on, and reads back the same", () => {
    const params = new GitPathsParams("/repo", ["a.txt", "src/b.ts"], "f1");

    assert.deepEqual(params.toJson(), { folder: "/repo", paths: ["a.txt", "src/b.ts"], basedOn: "f1" });
    assert.deepEqual(GitPathsParams.fromJson(JSON.parse(JSON.stringify(params.toJson()))), params);
  });

  it("takes 1 to 10000 paths", () => {
    const expected = { name: "ProtocolFieldException", field: "paths", message: "The field paths is invalid: expected 1 to 10000 paths." };

    assert.equal(new GitPathsParams("/repo", Array.from({ length: 10000 }, (_, index) => `f${index}`), "f").paths.length, 10000);
    assert.throws(() => new GitPathsParams("/repo", [], "f"), expected);
    assert.throws(() => new GitPathsParams("/repo", Array.from({ length: 10001 }, (_, index) => `f${index}`), "f"), expected);
    assert.throws(() => GitPathsParams.fromJson({ folder: "/repo", paths: [], basedOn: "f" }, "$.params"), { name: "ProtocolFieldException", field: "$.params.paths" });
  });

  it("refuses a path that isn't relative to the folder, naming it by its index", () => {
    assert.throws(() => new GitPathsParams("/repo", ["a.txt", "../b.txt"], "f"), { name: "ProtocolFieldException", field: "paths.1" });
    assert.throws(() => new GitPathsParams("/repo", ["/etc/passwd"], "f"), { name: "ProtocolFieldException", field: "paths.0" });
    assert.throws(() => GitPathsParams.fromJson({ folder: "/repo", paths: ["a", "b\\..\\..\\c"], basedOn: "f" }), { name: "ProtocolFieldException", field: "$.paths.1" });
    assert.throws(() => GitPathsParams.fromJson({ folder: "/repo", paths: ["a", 2], basedOn: "f" }), { name: "JsonException", path: "$.paths.1" });
  });

  it("refuses a relative folder, an empty or missing fingerprint and an unknown field, naming its path", () => {
    assert.throws(() => new GitPathsParams("repo", ["a"], "f"), { name: "ProtocolFieldException", field: "folder" });
    assert.throws(() => new GitPathsParams("/repo", ["a"], ""), { name: "ProtocolFieldException", field: "basedOn" });
    assert.throws(() => GitPathsParams.fromJson({ folder: "/repo", paths: ["a"] }), { name: "JsonException", path: "$.basedOn" });
    assert.throws(() => GitPathsParams.fromJson({ folder: "/repo", paths: "a", basedOn: "f" }), { name: "JsonException", path: "$.paths" });
    assert.throws(() => GitPathsParams.fromJson({ folder: "/repo", paths: ["a"], basedOn: "f", force: true }), { name: "ProtocolFieldException", field: "$.force" });
  });
});
