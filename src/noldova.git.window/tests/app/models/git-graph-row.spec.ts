/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitCommit, GitGraphCommit } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { GitGraphLine } from "../../../src/app/models/git-graph-line.ts";
import { GitGraphRow } from "../../../src/app/models/git-graph-row.ts";

describe("GitGraphRow", () => {
  const shownOf = (parents: readonly string[]): GitGraphCommit =>
    new GitGraphCommit(new GitCommit("c".repeat(40), parents, "Sample Author", "2026-11-20T14:02:00Z", "Follow renames"), "author@example.com", []);

  it("holds the shown commit and the commit in it, its lane, color, strokes and width", () => {
    const shown: GitGraphCommit = shownOf(["d".repeat(40)]);
    const lines: readonly GitGraphLine[] = [new GitGraphLine(0, false, 0, true, 1), new GitGraphLine(0, true, 1, false, 1)];
    const row: GitGraphRow = new GitGraphRow(shown, 0, 1, lines, 2);

    expect([row.shown, row.commit, row.lane, row.color, row.lines, row.width]).toEqual([shown, shown.commit, 0, 1, lines, 2]);
  });

  it.each([
    [[], false],
    [["d".repeat(40)], false],
    [["d".repeat(40), "e".repeat(40)], true],
    [["d".repeat(40), "e".repeat(40), "f".repeat(40)], true]
  ])("counts a commit with the parents %j as a merge: %j", (parents, isMerge) => {
    expect(new GitGraphRow(shownOf(parents), 0, 0, [], 1).isMerge).toBe(isMerge);
  });
});
