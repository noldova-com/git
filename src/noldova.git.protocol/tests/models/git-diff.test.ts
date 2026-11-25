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
import { DiffTotals } from "../../src/models/diff-totals.ts";
import { GitDiff } from "../../src/models/git-diff.ts";

describe("GitDiff", () => {
  const file = new DiffFile("a.bin", undefined, "a.bin", undefined, FileChange.Added, null, "100644", true, null, [], false);

  it("keeps its files, its size, the files it left out, whether it was cut and the whole diff's totals, and reads back the same", () => {
    const diff = new GitDiff([file], 180, 2, true, new DiffTotals(3, 40, 7));
    const whole = new GitDiff([], 0, 0, false);

    assert.deepEqual(diff.toJson(), { files: [file.toJson()], totalBytes: 180, omittedFiles: 2, truncated: true, totals: { files: 3, added: 40, removed: 7 } });
    assert.deepEqual(GitDiff.fromJson(JSON.parse(JSON.stringify(diff.toJson()))), diff);
    assert.deepEqual([whole.truncated, whole.totals], [false, null]);
    assert.deepEqual(whole.toJson(), { files: [], totalBytes: 0, omittedFiles: 0, truncated: false, totals: null });
    assert.deepEqual(GitDiff.fromJson(JSON.parse(JSON.stringify(whole.toJson()))), whole);
  });

  it("a diff that left files out is truncated, and only a truncated diff has totals", () => {
    assert.throws(() => new GitDiff([], 0, 1, false), { name: "ProtocolFieldException", field: "truncated", message: "The field truncated is invalid: expected true, since files were left out." });
    assert.throws(() => new GitDiff([], 0, 0, false, new DiffTotals(1, 1, 0)), { name: "ProtocolFieldException", field: "totals",
      message: "The field totals is invalid: expected no totals, since nothing was left out." });
    assert.throws(() => GitDiff.fromJson({ files: [], totalBytes: 0, omittedFiles: 0, truncated: true, totals: { files: -1, added: 0, removed: 0 } }),
      { name: "ProtocolFieldException", field: "$.totals.files" });
  });

  it("refuses negative counts, an invalid file and a field it doesn't define", () => {
    assert.throws(() => new GitDiff([], -1, 0, false), { name: "ProtocolFieldException", field: "totalBytes" });
    assert.throws(() => new GitDiff([], 0, -1, true), { name: "ProtocolFieldException", field: "omittedFiles" });
    assert.throws(() => GitDiff.fromJson({ files: [{}], totalBytes: 0, omittedFiles: 0, truncated: false, totals: null }), { name: "JsonException", path: "$.files.0.path" });
    assert.throws(() => GitDiff.fromJson({ files: [], totalBytes: 0, omittedFiles: 0, truncated: false, totals: null, scope: "Staged" }), { name: "ProtocolFieldException", field: "$.scope" });
  });
});
