/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { FileChange } from "../../src/enums/file-change.ts";
import { DiffFile } from "../../src/models/diff-file.ts";
import { GitDiff } from "../../src/models/git-diff.ts";

describe("GitDiff", () => {
  const file = new DiffFile("a.bin", undefined, "a.bin", undefined, FileChange.Added, null, "100644", true, null, [], false);

  it("keeps its files, its size, the files it left out and whether it was cut, and reads back the same", () => {
    const diff = new GitDiff([file], 180, 2, true);

    assert.deepEqual(diff.toJson(), { files: [file.toJson()], totalBytes: 180, omittedFiles: 2, truncated: true });
    assert.deepEqual(GitDiff.fromJson(JSON.parse(JSON.stringify(diff.toJson()))), diff);
    assert.equal(new GitDiff([], 0, 0, false).truncated, false);
  });

  it("a diff that left files out is truncated", () => {
    assert.throws(() => new GitDiff([], 0, 1, false), { name: "ProtocolFieldException", field: "truncated", message: "The field truncated is invalid: expected true, since files were left out." });
  });

  it("refuses negative counts, an invalid file and a field it doesn't define", () => {
    assert.throws(() => new GitDiff([], -1, 0, false), { name: "ProtocolFieldException", field: "totalBytes" });
    assert.throws(() => new GitDiff([], 0, -1, true), { name: "ProtocolFieldException", field: "omittedFiles" });
    assert.throws(() => GitDiff.fromJson({ files: [{}], totalBytes: 0, omittedFiles: 0, truncated: false }), { name: "JsonException", path: "$.files.0.path" });
    assert.throws(() => GitDiff.fromJson({ files: [], totalBytes: 0, omittedFiles: 0, truncated: false, scope: "Staged" }), { name: "ProtocolFieldException", field: "$.scope" });
  });
});
