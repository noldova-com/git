/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { WorktreeListParser } from "../../src/services/worktree-list.parser.ts";

describe("WorktreeListParser", () => {
  test("reads each entry's path, HEAD, branch, lock and prunable state, and skips what it doesn't use", () => {
    const output = Buffer.from([
      "worktree /r", "HEAD 1111", "branch refs/heads/main", "",
      "worktree /w/a", "HEAD 2222", "detached", "locked", "",
      "worktree /w/b b", "HEAD 3333", "branch refs/remotes/x", "locked reason with spaces", "prunable gitdir file points to non-existent location", "",
      "worktree /bare", "bare", "", ""
    ].join("\0"));

    const entries = WorktreeListParser.parse(output);

    assert.deepEqual(entries.map(t => [t.path, t.head, t.branch, t.lockReason, t.isLocked, t.isPrunable]), [
      ["/r", "1111", "main", null, false, false],
      ["/w/a", "2222", null, "", true, false],
      ["/w/b b", "3333", "refs/remotes/x", "reason with spaces", true, true],
      ["/bare", null, null, null, false, false]
    ]);
  });

  test("reads no entries from an empty output", () => {
    assert.deepEqual(WorktreeListParser.parse(Buffer.alloc(0)), []);
  });
});
