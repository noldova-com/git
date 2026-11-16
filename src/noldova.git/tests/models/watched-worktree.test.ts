/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { WatchStart } from "../../src/enums/watch-start.ts";
import { RepositoryFolders } from "../../src/models/repository-folders.ts";
import { WatchedWorktree } from "../../src/models/watched-worktree.ts";

describe("WatchedWorktree", () => {
  test("starts with no watchers, no poll, no fingerprint and nothing scheduled, running, started or stopped", async () => {
    const folders = new RepositoryFolders("/r", "/r/.git", "/r/.git");

    const watched = new WatchedWorktree("key", "/r", folders);

    assert.deepEqual([watched.key, watched.worktree, watched.folders, watched.watchers, watched.poll, watched.fingerprint],
      ["key", "/r", folders, [], null, null]);
    assert.deepEqual([watched.isScheduled, watched.isForced, watched.isPolledAlways, watched.stop.signal.aborted], [false, false, false, false]);
    assert.equal(await watched.running, undefined);
    assert.equal(await watched.started, WatchStart.Stopped);
  });
});
