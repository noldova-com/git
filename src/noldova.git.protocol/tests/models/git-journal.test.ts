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
import { GitJournal } from "../../src/models/git-journal.ts";
import { GitJournalEntry } from "../../src/models/git-journal-entry.ts";

describe("GitJournal", () => {
  const entryOf = (id: number): GitJournalEntry => new GitJournalEntry(String(id), "git.push", "2026-11-22T20:15:00Z", "main", "main", [], UndoMode.None, null, null);

  it("keeps up to 500 entries, reads them back the same, and refuses a 501st and an unknown field", () => {
    const journal = new GitJournal(Array.from({ length: 500 }, (_, index) => entryOf(index)));

    assert.deepEqual(GitJournal.fromJson(journal.toJson()), journal);
    assert.deepEqual([new GitJournal([]).toJson(), GitJournal.fromJson(new GitJournal([], true).toJson()).checkpoints], [{ entries: [], checkpoints: false }, true]);
    assert.throws(() => GitJournal.fromJson({ entries: Array.from({ length: 501 }, (_, index) => entryOf(index).toJson()), checkpoints: false }), { name: "ProtocolFieldException", field: "$.entries" });
    assert.throws(() => GitJournal.fromJson({ entries: [], checkpoints: false, more: 1 }), { name: "ProtocolFieldException" });
  });
});
