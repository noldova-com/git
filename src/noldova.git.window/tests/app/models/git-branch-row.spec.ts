/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitBranchRow } from "../../../src/app/models/git-branch-row.ts";

describe("GitBranchRow", () => {
  it("holds a remote's, a folder's and a branch's place in the tree, name, depth, count and whole branch name", () => {
    const rows: readonly GitBranchRow[] = [
      new GitBranchRow("origin/", "origin", 0, true, 3, ""),
      new GitBranchRow("origin/team/", "team", 1, true, 0, ""),
      new GitBranchRow("origin/team/a", "a", 2, false, 0, "origin/team/a")
    ];

    expect(rows.map(t => [t.key, t.name, t.depth, t.isFolder, t.count, t.branch])).toEqual([
      ["origin/", "origin", 0, true, 3, ""], ["origin/team/", "team", 1, true, 0, ""], ["origin/team/a", "a", 2, false, 0, "origin/team/a"]
    ]);
  });
});
