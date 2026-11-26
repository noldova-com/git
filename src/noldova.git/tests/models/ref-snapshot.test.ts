/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { RefSnapshot } from "../../src/models/ref-snapshot.ts";

describe("RefSnapshot", () => {
  const A = "a".repeat(40);
  const B = "b".repeat(40);
  const C = "c".repeat(40);
  const moves = (before: RefSnapshot, after: RefSnapshot): readonly (readonly (string | null)[])[] =>
    RefSnapshot.movesBetween(before, after).map(t => [t.name, t.before, t.after]);

  test("keeps what it was made with, and names HEAD's commit or a ref's object, or null for a ref it hasn't", () => {
    const refs = new Map([["refs/heads/main", A]]);
    const snapshot = new RefSnapshot("main", B, refs, C);

    assert.deepEqual([snapshot.branch, snapshot.head, snapshot.refs, snapshot.index], ["main", B, refs, C]);
    assert.deepEqual([snapshot.valueOf("HEAD"), snapshot.valueOf("refs/heads/main"), snapshot.valueOf("refs/tags/v1")], [B, A, null]);
  });

  test("lists each ref that moved, came or went, by name, and HEAD first only when a side is detached and its commit changed", () => {
    const before = new RefSnapshot("main", A, new Map([["refs/heads/main", A], ["refs/tags/v1", B], ["refs/heads/old", C]]), null);
    const after = new RefSnapshot("main", B, new Map([["refs/heads/main", B], ["refs/tags/v1", B], ["refs/heads/new", C]]), null);

    assert.deepEqual(moves(before, after), [["refs/heads/main", A, B], ["refs/heads/new", null, C], ["refs/heads/old", C, null]]);
    assert.deepEqual(moves(new RefSnapshot(null, A, new Map(), null), new RefSnapshot("main", B, new Map(), null)), [["HEAD", A, B]]);
    assert.deepEqual(moves(new RefSnapshot("main", A, new Map(), null), new RefSnapshot(null, B, new Map(), null)), [["HEAD", A, B]]);
    assert.deepEqual(moves(new RefSnapshot(null, A, new Map(), null), new RefSnapshot(null, A, new Map(), null)), []);
  });
});
