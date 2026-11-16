/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { describe, test } from "vitest";

import { WorktreeRecord } from "@noldova/git.protocol";

import { WorktreeState } from "../../src/enums/worktree-state.ts";
import { StoredWorktree } from "../../src/models/stored-worktree.ts";

describe("StoredWorktree", () => {
  const record = new WorktreeRecord("k", "/r", "/w/1f", "noldova/1f", "0123456789abcdef0123456789abcdef01234567");

  test("carries the record and its state", () => {
    const stored = new StoredWorktree(record, WorktreeState.Ready);

    assert.equal(stored.record, record);
    assert.equal(stored.state, WorktreeState.Ready);
  });

  test("is pending only while its create hasn't finished", () => {
    assert.equal(new StoredWorktree(record, WorktreeState.Pending).isPending, true);
    assert.equal(new StoredWorktree(record, WorktreeState.Ready).isPending, false);
  });
});
