/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitCommitDetailParams } from "../../src/models/git-commit-detail-params.ts";

const expected = (field: string, expectation: string): { name: string; field: string; message: string } =>
  ({ name: "ProtocolFieldException", field, message: `The field ${field} is invalid: expected ${expectation}.` });

describe("GitCommitDetailParams", () => {
  const id = "0123456789abcdef0123456789abcdef01234567";

  it("keeps its folder and commit id, and reads back the same, with a Windows folder and a SHA-256 id too", () => {
    const params = new GitCommitDetailParams("/home/a/repo", id);
    const windows = new GitCommitDetailParams("C:\\repo", "a".repeat(64));

    assert.deepEqual(params.toJson(), { folder: "/home/a/repo", id });
    assert.deepEqual(GitCommitDetailParams.fromJson(JSON.parse(JSON.stringify(params.toJson()))), params);
    assert.deepEqual(GitCommitDetailParams.fromJson(JSON.parse(JSON.stringify(windows.toJson()))), windows);
  });

  it("refuses a relative or too long folder and an id that isn't a full lowercase object id, naming its path", () => {
    const folder = "an absolute path of at most 4096 characters";
    const objectId = "a full hexadecimal object id";

    assert.throws(() => GitCommitDetailParams.fromJson({ folder: "repo", id }), expected("$.folder", folder));
    assert.throws(() => new GitCommitDetailParams(`/${"a".repeat(4096)}`, id), expected("folder", folder));
    assert.equal(new GitCommitDetailParams(`/${"a".repeat(4095)}`, id).folder.length, 4096);
    assert.throws(() => GitCommitDetailParams.fromJson({ folder: "/r", id: "0123456" }), expected("$.id", objectId));
    assert.throws(() => new GitCommitDetailParams("/r", id.toUpperCase()), expected("id", objectId));
  });

  it("refuses a missing id and a field it doesn't define", () => {
    assert.throws(() => GitCommitDetailParams.fromJson({ folder: "/r" }), { name: "JsonException", path: "$.id" });
    assert.throws(() => GitCommitDetailParams.fromJson({ folder: "/r", id, more: 1 }), expected("$.more", "none, since the model doesn't define it"));
  });
});
