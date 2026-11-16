/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { RepositoryFolders } from "../../src/models/repository-folders.ts";

describe("RepositoryFolders", () => {
  test("carries the worktree's top folder, its git folder and the common git folder", () => {
    assert.deepEqual({ ...new RepositoryFolders("/r/w", "/r/.git/worktrees/w", "/r/.git") }, {
      top: "/r/w",
      gitFolder: "/r/.git/worktrees/w",
      commonGitFolder: "/r/.git"
    });
  });
});
