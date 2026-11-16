/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { ConflictKind } from "../../src/enums/conflict-kind.ts";
import { FileState } from "../../src/enums/file-state.ts";
import { LineCounts } from "../../src/models/line-counts.ts";
import { StatusEntry } from "../../src/models/status-entry.ts";
import { SubmoduleStatus } from "../../src/models/submodule-status.ts";

describe("StatusEntry", () => {
  const roundTrip = (entry: StatusEntry): StatusEntry => StatusEntry.fromJson(JSON.parse(JSON.stringify(entry.toJson())));

  it("a modified file leaves out the bytes of a valid path", () => {
    const entry = new StatusEntry("a.txt", undefined, null, undefined, FileState.Modified, FileState.Unmodified, null, null, null, null);

    assert.deepEqual(entry.toJson(), {
      path: "a.txt",
      originalPath: null,
      index: "Modified",
      worktree: "Unmodified",
      conflict: null,
      submodule: null,
      indexCounts: null,
      worktreeCounts: null
    });
    assert.deepEqual(roundTrip(entry), entry);
  });

  it("keeps the lines added and removed on each side, and reads them back the same", () => {
    const entry = new StatusEntry("a.txt", undefined, null, undefined, FileState.Modified, FileState.Modified, null, null, new LineCounts(3, 1), new LineCounts(0, 2));

    assert.deepEqual(entry.toJson()["indexCounts"], { added: 3, removed: 1 });
    assert.deepEqual(entry.toJson()["worktreeCounts"], { added: 0, removed: 2 });
    assert.deepEqual(roundTrip(entry), entry);
  });

  it("a rename keeps its original path, and each path keeps its bytes when it isn't valid UTF-8", () => {
    const entry = new StatusEntry("b�.txt", "Yv8udHh0", "a�.txt", "Yf8udHh0", FileState.Renamed, FileState.Unmodified, null, null, null, null);

    assert.deepEqual(entry.toJson(), {
      path: "b�.txt",
      pathBytes: "Yv8udHh0",
      originalPath: "a�.txt",
      originalPathBytes: "Yf8udHh0",
      index: "Renamed",
      worktree: "Unmodified",
      conflict: null,
      submodule: null,
      indexCounts: null,
      worktreeCounts: null
    });
    assert.deepEqual(roundTrip(entry), entry);
  });

  it("a conflict and a submodule read back the same", () => {
    const conflict = new StatusEntry("a.txt", undefined, null, undefined, FileState.Unmodified, FileState.Unmodified, ConflictKind.BothModified, null, null, null);
    const submodule = new StatusEntry("lib", undefined, null, undefined, FileState.Unmodified, FileState.Modified, null, new SubmoduleStatus(true, false, false), null, null);

    assert.deepEqual(roundTrip(conflict), conflict);
    assert.deepEqual(roundTrip(submodule), submodule);
    assert.deepEqual(submodule.toJson()["submodule"], { commitChanged: true, trackedChanges: false, untrackedChanges: false });
  });

  it("has an original path exactly when it is renamed or copied", () => {
    const expected = { name: "ProtocolFieldException", field: "originalPath", message: "The field originalPath is invalid: expected a path exactly when the entry is renamed or copied." };

    assert.throws(() => new StatusEntry("b", undefined, null, undefined, FileState.Renamed, FileState.Unmodified, null, null, null, null), expected);
    assert.throws(() => new StatusEntry("b", undefined, "a", undefined, FileState.Modified, FileState.Unmodified, null, null, null, null), expected);
    assert.equal(new StatusEntry("b", undefined, "a", undefined, FileState.Unmodified, FileState.Copied, null, null, null, null).originalPath, "a");
  });

  it("a conflict has both states unmodified", () => {
    const expected = { name: "ProtocolFieldException", field: "index", message: "The field index is invalid: expected Unmodified, since the entry is a conflict." };

    assert.throws(() => new StatusEntry("a", undefined, null, undefined, FileState.Modified, FileState.Unmodified, ConflictKind.BothModified, null, null, null), expected);
    assert.throws(() => new StatusEntry("a", undefined, null, undefined, FileState.Unmodified, FileState.Deleted, ConflictKind.DeletedByThem, null, null, null), { name: "ProtocolFieldException", field: "worktree" });
  });

  it("refuses empty paths, bytes without an original path, invalid bytes and unknown states", () => {
    assert.throws(() => new StatusEntry("", undefined, null, undefined, FileState.Added, FileState.Unmodified, null, null, null, null), { name: "ProtocolFieldException", field: "path" });
    assert.throws(() => new StatusEntry("a", "YQ", null, undefined, FileState.Added, FileState.Unmodified, null, null, null, null), { name: "ProtocolFieldException", field: "pathBytes" });
    assert.throws(() => new StatusEntry("b", undefined, "", undefined, FileState.Renamed, FileState.Unmodified, null, null, null, null), { name: "ProtocolFieldException", field: "originalPath" });
    assert.throws(() => new StatusEntry("b", undefined, null, "YQ==", FileState.Added, FileState.Unmodified, null, null, null, null), { name: "ProtocolFieldException", field: "originalPathBytes" });
    assert.throws(() => new StatusEntry("b", undefined, "a", "YQ", FileState.Renamed, FileState.Unmodified, null, null, null, null), { name: "ProtocolFieldException", field: "originalPathBytes" });
    const json = { path: "a", originalPath: null, index: "Changed", worktree: "Unmodified", conflict: null, submodule: null, indexCounts: null, worktreeCounts: null };
    assert.throws(() => StatusEntry.fromJson(json, "$.entries[3]"), { name: "JsonException", path: "$.entries[3].index" });
    assert.throws(() => StatusEntry.fromJson({ ...json, index: "Added", conflict: "Both" }), { name: "JsonException", path: "$.conflict" });
    assert.throws(() => StatusEntry.fromJson({ ...json, index: "Added", staged: true }), { name: "ProtocolFieldException", field: "$.staged" });
  });

  it("refuses missing or invalid line counts, naming their path", () => {
    const json = { path: "a", originalPath: null, index: "Modified", worktree: "Unmodified", conflict: null, submodule: null, indexCounts: null, worktreeCounts: null };
    const missing = { path: "a", originalPath: null, index: "Modified", worktree: "Unmodified", conflict: null, submodule: null, indexCounts: null };

    assert.throws(() => StatusEntry.fromJson(missing),{ name: "JsonException", path: "$.worktreeCounts" });
    assert.throws(() => StatusEntry.fromJson({ ...json, indexCounts: 3 }), { name: "JsonException", path: "$.indexCounts" });
    assert.throws(() => StatusEntry.fromJson({ ...json, indexCounts: { added: -1, removed: 0 } }), { name: "ProtocolFieldException", field: "$.indexCounts.added" });
    assert.throws(() => StatusEntry.fromJson({ ...json, worktreeCounts: { added: 0, removed: 0, moved: 0 } }), { name: "ProtocolFieldException", field: "$.worktreeCounts.moved" });
  });
});
