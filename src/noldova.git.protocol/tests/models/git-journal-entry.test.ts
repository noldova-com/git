/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { UndoMode } from "../../src/enums/undo-mode.ts";
import { GitJournalEntry } from "../../src/models/git-journal-entry.ts";
import { GitRefMove } from "../../src/models/git-ref-move.ts";

interface IRefusal {
  readonly change: Record<string, unknown>;
  readonly field: string;
}

describe("GitJournalEntry", () => {
  const a = "0123456789abcdef0123456789abcdef01234567";
  const b = "89abcdef0123456789abcdef0123456789abcdef";
  const at = "2026-11-22T20:15:00Z";
  const valid = { id: "1", method: "git.commit", at, branch: "main", branchAfter: "main", moves: [{ name: "refs/heads/main", before: a, after: b }], undo: "Refs", indexBefore: null, indexAfter: null, checkpoint: null, paths: [] };

  it("keeps a commit's entry and an index write's trees, and reads each back the same", () => {
    const commit = new GitJournalEntry("1", "git.commit", at, "main", "main", [new GitRefMove("refs/heads/main", a, b)], UndoMode.Refs, null, null);
    const stage = new GitJournalEntry("2", "git.stage", "2026-11-22T12:15:00-08:00", null, null, [], UndoMode.Index, a, b);
    const discard = new GitJournalEntry("3", "git.discard", at, "main", "main", [], UndoMode.Checkpoint, null, null, "c-1", ["a.txt", "src/b.ts"]);

    assert.deepEqual(commit.toJson(), valid);
    assert.deepEqual(GitJournalEntry.fromJson(commit.toJson()), commit);
    assert.deepEqual(GitJournalEntry.fromJson(stage.toJson()), stage);
    assert.deepEqual([discard.checkpoint, discard.paths, GitJournalEntry.fromJson(discard.toJson())], ["c-1", ["a.txt", "src/b.ts"], discard]);
  });

  it("refuses an empty or broken id or method, a time without its offset or that isn't a date, a branch git refuses, an unknown mode and an unknown field", () => {
    const refusals: IRefusal[] = [
      { change: { id: "" }, field: "$.id" },
      { change: { id: "1\n" }, field: "$.id" },
      { change: { method: "" }, field: "$.method" },
      { change: { method: "git.\u0001" }, field: "$.method" },
      { change: { at: "2026-11-22T20:15:00" }, field: "$.at" },
      { change: { at: "2026-13-45T20:15:00Z" }, field: "$.at" },
      { change: { branch: "a..b" }, field: "$.branch" },
      { change: { branchAfter: "-a" }, field: "$.branchAfter" }
    ];
    for (const { change, field } of refusals)
      assert.throws(() => GitJournalEntry.fromJson({ ...valid, ...change }), { name: "ProtocolFieldException", field });
    assert.throws(() => GitJournalEntry.fromJson({ ...valid, undo: "Hard" }), { name: "JsonException", path: "$.undo" });
    assert.throws(() => GitJournalEntry.fromJson({ ...valid, more: 1 }), { name: "ProtocolFieldException" });
  });

  it("holds trees exactly when the index undoes it, both or neither, each a full id", () => {
    const refusals: IRefusal[] = [
      { change: { indexBefore: "abc", indexAfter: b, undo: "Index" }, field: "$.indexBefore" },
      { change: { indexBefore: a, indexAfter: "abc", undo: "Index" }, field: "$.indexAfter" },
      { change: { indexBefore: null, indexAfter: null, undo: "Index" }, field: "$.indexAfter" },
      { change: { indexBefore: a, indexAfter: b, undo: "Refs" }, field: "$.indexAfter" },
      { change: { indexBefore: a, indexAfter: null, undo: "Refs" }, field: "$.indexAfter" },
      { change: { indexBefore: null, indexAfter: b, undo: "Index" }, field: "$.indexAfter" }
    ];
    for (const { change, field } of refusals)
      assert.throws(() => GitJournalEntry.fromJson({ ...valid, ...change }), { name: "ProtocolFieldException", field });
  });

  it("holds a checkpoint and the paths it puts back exactly when a checkpoint undoes it, each path relative and the checkpoint one line", () => {
    const refusals: IRefusal[] = [
      { change: { undo: "Checkpoint" }, field: "$.checkpoint" },
      { change: { undo: "Checkpoint", checkpoint: "c-1" }, field: "$.checkpoint" },
      { change: { undo: "Checkpoint", paths: ["a.txt"] }, field: "$.checkpoint" },
      { change: { checkpoint: "c-1", paths: ["a.txt"] }, field: "$.checkpoint" },
      { change: { paths: ["a.txt"] }, field: "$.checkpoint" },
      { change: { undo: "Checkpoint", checkpoint: "", paths: ["a.txt"] }, field: "$.checkpoint" },
      { change: { undo: "Checkpoint", checkpoint: "c\n1", paths: ["a.txt"] }, field: "$.checkpoint" },
      { change: { undo: "Checkpoint", checkpoint: "c-1", paths: ["../a.txt"] }, field: "$.paths.0" }
    ];
    for (const { change, field } of refusals)
      assert.throws(() => GitJournalEntry.fromJson({ ...valid, ...change }), { name: "ProtocolFieldException", field });
  });

  it("holds a stash's commit and no paths exactly when popping the stash undoes it, the commit a full id", () => {
    const stash = { ...valid, undo: "Stash", checkpoint: "a".repeat(40) };
    const refusals: IRefusal[] = [
      { change: { undo: "Stash" }, field: "$.checkpoint" },
      { change: { undo: "Stash", checkpoint: "a".repeat(40), paths: ["a.txt"] }, field: "$.checkpoint" },
      { change: { undo: "Stash", checkpoint: "c-1" }, field: "$.checkpoint" }
    ];

    assert.deepEqual(GitJournalEntry.fromJson(stash).toJson(), stash);
    for (const { change, field } of refusals)
      assert.throws(() => GitJournalEntry.fromJson({ ...valid, ...change }), { name: "ProtocolFieldException", field });
  });
});
