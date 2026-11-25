/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";

import { describe, test } from "vitest";

import type { JsonValue } from "@noldova/context.json";
import { GitRefMove, UndoMode } from "@noldova/git.protocol";

import { RefSnapshot } from "../../src/models/ref-snapshot.ts";
import { Journal } from "../../src/services/journal.ts";

describe("Journal", () => {
  const a = "0123456789abcdef0123456789abcdef01234567";
  const b = "89abcdef0123456789abcdef0123456789abcdef";
  const c = "fedcba9876543210fedcba9876543210fedcba98";
  const snapshot = (branch: string | null, head: string | null, refs: Record<string, string>, index: string | null = null): RefSnapshot =>
    new RefSnapshot(branch, head, new Map(Object.entries(refs)), index);
  const clock = (): Date => new Date("2026-11-22T20:15:00.123Z");

  test("records the refs a write moved, created and deleted, with HEAD itself when it was detached, at the second the write ended", () => {
    const journal = new Journal(clock);
    const before = snapshot(null, a, { "refs/heads/main": a, "refs/tags/old": b });
    const after = snapshot("main", b, { "refs/heads/main": b, "refs/heads/new": c });

    const entry = journal.record("/r/.git", "git.switchBranch", UndoMode.Switch, before, after);

    assert.deepEqual([entry.id, entry.method, entry.at, entry.branch, entry.branchAfter, entry.undo], ["1", "git.switchBranch", "2026-11-22T20:15:00Z", null, "main", UndoMode.Switch]);
    assert.deepEqual(entry.moves, [new GitRefMove("HEAD", a, b), new GitRefMove("refs/heads/main", a, b), new GitRefMove("refs/heads/new", null, c), new GitRefMove("refs/tags/old", b, null)]);
    assert.deepEqual(journal.read("/r/.git").entries, [entry]);
    assert.deepEqual(new Journal().record("/r/.git", "git.push", UndoMode.None, before, before).moves, []);
  });

  test("keeps an index write's trees, takes one whose index couldn't be read as not undoable, and keeps no trees for other writes", () => {
    const journal = new Journal(clock);
    const read = journal.record("/r/.git", "git.stage", UndoMode.Index, snapshot("main", a, {}, b), snapshot("main", a, {}, c));
    const unread = journal.record("/r/.git", "git.stage", UndoMode.Index, snapshot("main", a, {}, null), snapshot("main", a, {}, c));
    const later = journal.record("/r/.git", "git.stage", UndoMode.Index, snapshot("main", a, {}, b), snapshot("main", a, {}, null));
    const other = journal.record("/r/.git", "git.commit", UndoMode.Refs, snapshot("main", a, {}, b), snapshot("main", a, {}, c));

    assert.deepEqual([read.undo, read.indexBefore, read.indexAfter], [UndoMode.Index, b, c]);
    assert.deepEqual([unread.undo, unread.indexBefore, unread.indexAfter], [UndoMode.None, null, null]);
    assert.deepEqual([later.undo, later.indexBefore], [UndoMode.None, null]);
    assert.deepEqual([other.undo, other.indexBefore], [UndoMode.Refs, null]);
  });

  test("keeps as many writes as the setting asks, and 50 when it isn't a whole number from 1 to 500", () => {
    let limit: JsonValue = 10;
    const journal = new Journal(clock, () => limit);
    const write = (): void => void journal.record("/r/.git", "git.commit", UndoMode.Refs, snapshot("main", a, {}), snapshot("main", b, {}));

    for (let i = 0; i < 12; i++)
      write();
    assert.equal(journal.read("/r/.git").entries.length, 10);
    assert.equal(journal.read("/r/.git").entries[0]?.id, "3");
    for (const value of [0, -1, 501, 10.5, "20", null]) {
      limit = value;
      assert.equal(Journal.limitOf(limit), 50);
    }
    assert.equal(Journal.limitOf(500), 500);
    assert.equal(Journal.limitOf(1), 1);
  });

  test("keeps each repository's last 50 writes apart, finds one by its id, and takes an undone one out", () => {
    const journal = new Journal(clock);
    const same = snapshot("main", a, {});
    for (let index = 0; index < 51; index += 1)
      journal.record("/r/.git", "git.push", UndoMode.None, same, same);
    const other = journal.record("/s/.git", "git.push", UndoMode.None, same, same);

    assert.deepEqual(journal.read("/r/.git").entries.map(t => t.id).slice(0, 2), ["2", "3"]);
    assert.equal(journal.read("/r/.git").entries.length, 50);
    assert.deepEqual(journal.read("/s/.git").entries, [other]);
    assert.deepEqual(journal.read("/t/.git").entries, []);
    assert.equal(journal.find("/s/.git", other.id), other);
    assert.equal(journal.find("/r/.git", other.id), null);
    assert.equal(journal.find("/t/.git", other.id), null);

    journal.remove("/s/.git", other.id);
    journal.remove("/t/.git", other.id);
    assert.deepEqual(journal.read("/s/.git").entries, []);
    assert.deepEqual(journal.read("/t/.git").entries, []);
  });
});
