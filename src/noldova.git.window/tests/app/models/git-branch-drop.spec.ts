/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitBranchDrop } from "../../../src/app/models/git-branch-drop.ts";

describe("GitBranchDrop", () => {
  const a: string = "a".repeat(40);
  const b: string = "b".repeat(40);
  const read = (drop: GitBranchDrop): readonly (boolean | string | null)[] => [drop.canMerge, drop.canSwitchAndMerge, drop.canRebase, drop.predicted];

  it("holds the dropped branch, the target, their commits, the current branch and whether the target is local", () => {
    const drop: GitBranchDrop = new GitBranchDrop("feature", b, "origin/main", a, null, false);

    expect([drop.source, drop.sourceId, drop.target, drop.targetId, drop.current, drop.isTargetLocal]).toEqual(["feature", b, "origin/main", a, null, false]);
  });

  it("merges into the current branch, and predicts the dropped branch's commit", () => {
    expect(read(new GitBranchDrop("feature", b, "main", a, "main", true))).toEqual([true, false, false, b]);
  });

  it("rebases the current branch onto the target, offers to switch to a local target first, and predicts the target's commit", () => {
    expect(read(new GitBranchDrop("main", a, "feature", b, "main", true))).toEqual([false, true, true, b]);
  });

  it("offers no switch to a remote target, and predicts nothing when neither branch is current", () => {
    expect([read(new GitBranchDrop("main", a, "origin/feature", b, "main", false)), read(new GitBranchDrop("feature", b, "topic", a, "main", true))]).toEqual([
      [false, false, true, b], [false, true, false, null]
    ]);
  });

  it("offers no switch and predicts nothing when both branches point at the same commit", () => {
    expect([read(new GitBranchDrop("feature", a, "main", a, "main", true)), read(new GitBranchDrop("main", a, "feature", a, "main", true))]).toEqual([
      [true, false, false, null], [false, false, true, null]
    ]);
  });
});
