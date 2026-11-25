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
import { OperationKind } from "../../src/enums/operation-kind.ts";
import { GitConflict } from "../../src/models/git-conflict.ts";

/** A conflict's kind and the texts of its stages that kind has. */
interface IConflictCase {
  readonly kind: ConflictKind;
  readonly base: string | null;
  readonly ours: string | null;
  readonly theirs: string | null;
}

describe("GitConflict", () => {
  it("keeps a both-modified conflict with its merged text, and reads back the same", () => {
    const conflict = new GitConflict("a.ts", ConflictKind.BothModified, OperationKind.Merge, "b\n", "o\n", "t\n", "<<<<<<< main\n", "main",
      "feature", null, null, false, false);

    assert.deepEqual(conflict.toJson(), {
      path: "a.ts",
      kind: "BothModified",
      operation: "Merge",
      base: "b\n",
      ours: "o\n",
      theirs: "t\n",
      merged: "<<<<<<< main\n",
      oursLabel: "main",
      theirsLabel: "feature",
      oursCommit: null,
      theirsCommit: null,
      binary: false,
      reused: false
    });
    assert.deepEqual(GitConflict.fromJson(JSON.parse(JSON.stringify(conflict.toJson()))), conflict);
  });

  it("keeps each side's commit, reads back the same, and reads a conflict without them, as an older runtime sends it, as having none", () => {
    const ours: string = "a".repeat(40);
    const theirs: string = "b".repeat(64);
    const conflict = new GitConflict("a.ts", ConflictKind.BothModified, OperationKind.Merge, "b\n", "o\n", "t\n", "m\n", "main", "feature", ours, theirs, false, false);
    const { oursCommit: _ours, theirsCommit: _theirs, ...older } = conflict.toJson();

    assert.deepEqual([conflict.oursCommit, conflict.theirsCommit, conflict.toJson()["oursCommit"], conflict.toJson()["theirsCommit"]], [ours, theirs, ours, theirs]);
    assert.deepEqual(GitConflict.fromJson(JSON.parse(JSON.stringify(conflict.toJson()))), conflict);
    assert.deepEqual([GitConflict.fromJson(older).oursCommit, GitConflict.fromJson(older).theirsCommit], [null, null]);
  });

  it("refuses a side's commit that isn't a full object id, given or read", () => {
    const json = new GitConflict("a.ts", ConflictKind.BothDeleted, null, "b", null, null, null, "o", "t", null, null, false, false).toJson();

    assert.throws(() => new GitConflict("a.ts", ConflictKind.BothDeleted, null, "b", null, null, null, "o", "t", "abc1234", null, false, false),
      { name: "ProtocolFieldException", field: "oursCommit" });
    assert.throws(() => GitConflict.fromJson({ ...json, theirsCommit: "z".repeat(40) }, "$.result"), { name: "ProtocolFieldException", field: "$.result.theirsCommit" });
    assert.throws(() => GitConflict.fromJson({ ...json, oursCommit: 7 }), { name: "JsonException", path: "$.oursCommit" });
  });

  it("keeps each kind with exactly its stages, a merged text only when both sides have text, and a reused resolution", () => {
    const cases: readonly IConflictCase[] = [
      { kind: ConflictKind.BothAdded, base: null, ours: "o", theirs: "t" },
      { kind: ConflictKind.BothDeleted, base: "b", ours: null, theirs: null },
      { kind: ConflictKind.AddedByUs, base: null, ours: "o", theirs: null },
      { kind: ConflictKind.AddedByThem, base: null, ours: null, theirs: "t" },
      { kind: ConflictKind.DeletedByUs, base: "b", ours: null, theirs: "t" },
      { kind: ConflictKind.DeletedByThem, base: "b", ours: "o", theirs: null }
    ];
    for (const { kind, base, ours, theirs } of cases) {
      const merged = ours !== null && theirs !== null ? "m" : null;
      const conflict = new GitConflict("a.ts", kind, null, base, ours, theirs, merged, "ours", "theirs", null, null, false, false);

      assert.deepEqual(GitConflict.fromJson(conflict.toJson()), conflict);
    }
    assert.equal(new GitConflict("a.ts", ConflictKind.BothModified, OperationKind.Rebase, "b", "o", "t", "m", "onto main", "your commit abc1234", null, null, false,
      true).reused, true);
  });

  it("keeps a binary conflict with no texts", () => {
    const conflict = new GitConflict("a.png", ConflictKind.BothModified, OperationKind.CherryPick, null, null, null, null, "main", "abc1234", null, null, true, false);

    assert.deepEqual(GitConflict.fromJson(conflict.toJson()), conflict);
  });

  it("refuses a stage its kind doesn't have, a missing one, and a text in a binary conflict, naming the field", () => {
    assert.throws(() => new GitConflict("a.ts", ConflictKind.AddedByUs, null, "b", "o", null, null, "o", "t", null, null, false, false),
      { name: "ProtocolFieldException", field: "base", message: /has this stage/u });
    assert.throws(() => new GitConflict("a.ts", ConflictKind.BothModified, null, "b", null, "t", null, "o", "t", null, null, false, false),
      { name: "ProtocolFieldException", field: "ours" });
    assert.throws(() => new GitConflict("a.ts", ConflictKind.DeletedByThem, null, "b", "o", "t", "m", "o", "t", null, null, false, false),
      { name: "ProtocolFieldException", field: "theirs" });
    assert.throws(() => new GitConflict("a.png", ConflictKind.BothModified, null, "b", null, null, null, "o", "t", null, null, true, false),
      { name: "ProtocolFieldException", field: "base", message: /binary/u });
  });

  it("refuses a merged text without both sides, a missing one with both, and a reused resolution without one", () => {
    assert.throws(() => new GitConflict("a.ts", ConflictKind.DeletedByUs, null, "b", null, "t", "m", "o", "t", null, null, false, false),
      { name: "ProtocolFieldException", field: "merged" });
    assert.throws(() => new GitConflict("a.ts", ConflictKind.BothAdded, null, null, "o", "t", null, "o", "t", null, null, false, false),
      { name: "ProtocolFieldException", field: "merged" });
    assert.throws(() => new GitConflict("a.ts", ConflictKind.AddedByThem, null, null, null, "t", null, "o", "t", null, null, false, true),
      { name: "ProtocolFieldException", field: "reused" });
  });

  it("refuses an empty or multi-line label, an invalid path, an unknown operation and an unknown field, naming their path", () => {
    assert.throws(() => new GitConflict("a.ts", ConflictKind.BothDeleted, null, "b", null, null, null, "", "t", null, null, false, false),
      { name: "ProtocolFieldException", field: "oursLabel" });
    assert.throws(() => new GitConflict("a.ts", ConflictKind.BothDeleted, null, "b", null, null, null, "o", "a\nb", null, null, false, false),
      { name: "ProtocolFieldException", field: "theirsLabel" });
    assert.throws(() => new GitConflict("../a.ts", ConflictKind.BothDeleted, null, "b", null, null, null, "o", "t", null, null, false, false),
      { name: "ProtocolFieldException", field: "path" });
    const json = new GitConflict("a.ts", ConflictKind.BothDeleted, null, "b", null, null, null, "o", "t", null, null, false, false).toJson();
    assert.throws(() => GitConflict.fromJson({ ...json, operation: "Bisect" }), { name: "JsonException", path: "$.operation" });
    assert.throws(() => GitConflict.fromJson({ ...json, oursLabel: "" }, "$.result"), { name: "ProtocolFieldException", field: "$.result.oursLabel" });
    assert.throws(() => GitConflict.fromJson({ ...json, stage: 2 }), { name: "ProtocolFieldException", field: "$.stage" });
  });
});
