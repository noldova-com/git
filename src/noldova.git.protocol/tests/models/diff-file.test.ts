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
import { LineKind } from "../../src/enums/line-kind.ts";
import { DiffFile } from "../../src/models/diff-file.ts";
import { DiffHunk } from "../../src/models/diff-hunk.ts";
import { DiffLine } from "../../src/models/diff-line.ts";
import { SubmoduleChange } from "../../src/models/submodule-change.ts";

describe("DiffFile", () => {
  const hunk = new DiffHunk(1, 1, 1, 1, "", [new DiffLine(LineKind.Removed, 1, null, "a"), new DiffLine(LineKind.Added, null, 1, "b")]);
  const roundTrip = (file: DiffFile): DiffFile => DiffFile.fromJson(JSON.parse(JSON.stringify(file.toJson())));

  it("a modified text file keeps its hunks and leaves out the bytes of valid paths", () => {
    const file = new DiffFile("a.txt", undefined, "a.txt", undefined, FileChange.Modified, "100644", "100644", false, null, [hunk], false);

    assert.deepEqual(file.toJson(), {
      path: "a.txt",
      oldPath: "a.txt",
      change: "Modified",
      oldMode: "100644",
      newMode: "100644",
      binary: false,
      submodule: null,
      hunks: [hunk.toJson()],
      truncated: false
    });
    assert.deepEqual(roundTrip(file), file);
  });

  it("a renamed file keeps each path's bytes when it isn't valid UTF-8", () => {
    const file = new DiffFile("b�.txt", "Yv8udHh0", "a�.txt", "Yf8udHh0", FileChange.Renamed, "100644", "100644", false, null, [], true);

    assert.equal(file.toJson()["pathBytes"], "Yv8udHh0");
    assert.equal(file.toJson()["oldPathBytes"], "Yf8udHh0");
    assert.deepEqual(roundTrip(file), file);
  });

  it("an added file has no old mode, a deleted one no new mode, and a submodule its commits", () => {
    const added = new DiffFile("a", undefined, "a", undefined, FileChange.Added, null, "100644", true, null, [], false);
    const deleted = new DiffFile("a", undefined, "a", undefined, FileChange.Deleted, "100755", null, false, null, [], false);
    const submodule = new DiffFile("lib", undefined, "lib", undefined, FileChange.Modified, "160000", "160000", false, new SubmoduleChange("1".repeat(40), "2".repeat(40)), [], false);

    for (const file of [added, deleted, submodule])
      assert.deepEqual(roundTrip(file), file);
    assert.throws(() => new DiffFile("a", undefined, "a", undefined, FileChange.Added, "100644", "100644", false, null, [], false), { name: "ProtocolFieldException", field: "oldMode", message: "The field oldMode is invalid: expected null." });
    assert.throws(() => new DiffFile("a", undefined, "a", undefined, FileChange.Deleted, "100644", "100644", false, null, [], false), { name: "ProtocolFieldException", field: "newMode" });
  });

  it("keeps the path and its bytes as the old path unless the file is renamed or copied", () => {
    const expected = { name: "ProtocolFieldException", field: "oldPath", message: "The field oldPath is invalid: expected the path itself, unless the file is renamed or copied." };

    assert.throws(() => new DiffFile("b", undefined, "a", undefined, FileChange.Modified, "100644", "100644", false, null, [], false), expected);
    assert.throws(() => new DiffFile("a", "Yf8=", "a", undefined, FileChange.Modified, "100644", "100644", false, null, [], false), expected);
    assert.equal(new DiffFile("b", undefined, "a", undefined, FileChange.Copied, "100644", "100644", false, null, [], false).oldPath, "a");
  });

  it("a renamed or copied file keeps Git's similarity score, left out of the JSON form for any other change", () => {
    const renamed = new DiffFile("b", undefined, "a", undefined, FileChange.Renamed, "100644", "100644", false, null, [], false, 92);
    const copied = new DiffFile("c", undefined, "a", undefined, FileChange.Copied, "100644", "100644", false, null, [], false, 100);

    assert.deepEqual([renamed.toJson()["similarity"], roundTrip(renamed).similarity, roundTrip(copied).similarity], [92, 92, 100]);
    assert.equal("similarity" in new DiffFile("a", undefined, "a", undefined, FileChange.Modified, "100644", "100644", false, null, [], false).toJson(), false);
    assert.equal(DiffFile.fromJson({ path: "b", oldPath: "a", change: "Renamed", oldMode: null, newMode: null, binary: false, submodule: null, hunks: [], truncated: false }).similarity, null);
  });

  it("refuses a similarity outside 0 to 100, not whole, or on a file that isn't renamed or copied", () => {
    const expected = { name: "ProtocolFieldException", field: "similarity", message: "The field similarity is invalid: expected a whole percent from 0 to 100 on a renamed or copied file, or no value." };

    for (const [change, similarity] of [[FileChange.Renamed, 101], [FileChange.Renamed, -1], [FileChange.Copied, 9.5], [FileChange.Modified, 50]] as const)
      assert.throws(() => new DiffFile("b", undefined, change === FileChange.Modified ? "b" : "a", undefined, change, null, null, false, null, [], false, similarity), expected);
    assert.throws(() => DiffFile.fromJson({ path: "b", oldPath: "a", change: "Renamed", oldMode: null, newMode: null, binary: false, submodule: null, hunks: [], truncated: false, similarity: 300 }, "$.files[0]"),
      { name: "ProtocolFieldException", field: "$.files[0].similarity" });
  });

  it("a binary file has no hunks", () => {
    assert.throws(() => new DiffFile("a", undefined, "a", undefined, FileChange.Modified, "100644", "100644", true, null, [hunk], false),
      { name: "ProtocolFieldException", field: "hunks", message: "The field hunks is invalid: expected no hunks, since the file is binary." });
  });

  it("refuses empty paths, invalid bytes and modes, and invalid nested values, naming their paths", () => {
    assert.throws(() => new DiffFile("", undefined, "a", undefined, FileChange.Modified, null, null, false, null, [], false), { name: "ProtocolFieldException", field: "path" });
    assert.throws(() => new DiffFile("a", "YQ", "a", undefined, FileChange.Modified, null, null, false, null, [], false), { name: "ProtocolFieldException", field: "pathBytes" });
    assert.throws(() => new DiffFile("a", undefined, "", undefined, FileChange.Modified, null, null, false, null, [], false), { name: "ProtocolFieldException", field: "oldPath" });
    assert.throws(() => new DiffFile("a", undefined, "a", "YQ", FileChange.Modified, null, null, false, null, [], false), { name: "ProtocolFieldException", field: "oldPathBytes" });
    assert.throws(() => new DiffFile("a", undefined, "a", undefined, FileChange.Modified, "644", null, false, null, [], false), { name: "ProtocolFieldException", field: "oldMode" });
    assert.throws(() => new DiffFile("a", undefined, "a", undefined, FileChange.Modified, null, "755", false, null, [], false), { name: "ProtocolFieldException", field: "newMode" });
    const json = { path: "a", oldPath: "a", change: "Modified", oldMode: null, newMode: null, binary: false, submodule: null, hunks: [], truncated: false };
    assert.throws(() => DiffFile.fromJson({ ...json, change: "Changed" }, "$.files[1]"), { name: "JsonException", path: "$.files[1].change" });
    assert.throws(() => DiffFile.fromJson({ ...json, submodule: { oldCommit: null, newCommit: null } }), { name: "ProtocolFieldException", field: "$.submodule.oldCommit" });
    assert.throws(() => DiffFile.fromJson({ ...json, hunks: [{}] }), { name: "JsonException", path: "$.hunks.0.oldStart" });
    assert.throws(() => DiffFile.fromJson({ ...json, size: 1 }), { name: "ProtocolFieldException", field: "$.size" });
  });
});
