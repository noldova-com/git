/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitBranchTreeNode } from "../../../src/app/models/git-branch-tree-node.ts";

describe("GitBranchTreeNode", () => {
  it("holds a level's name and the names under it, or null for a branch", () => {
    const value: GitBranchTreeNode = new GitBranchTreeNode("team", ["a", "b"]);

    expect([value.name, value.children]).toEqual(["team", ["a", "b"]]);
  });
});
