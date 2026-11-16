/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DiffFile, DiffHunk, DiffLine, FileChange, LineKind } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { GitDiffRowKind } from "../../../src/app/enums/git-diff-row-kind.ts";
import { GitDiffRow } from "../../../src/app/models/git-diff-row.ts";
import { GitFixtures } from "../../fixtures/git-fixtures.fixture.ts";

describe("GitDiffRow", () => {
  const file = (binary: boolean, hunks: readonly DiffHunk[], truncated: boolean): DiffFile =>
    new DiffFile("a.ts", undefined, "a.ts", undefined, FileChange.Modified, null, null, binary, null, hunks, truncated);

  it("draws a hunk's header, then each line with its sign, and a missing newline as a note", () => {
    const [diffFile] = GitFixtures.diff("a.ts", [LineKind.Context, "a"], [LineKind.Removed, "b"], [LineKind.Added, "c"], [LineKind.NoNewlineAtEnd, ""]).files;

    expect(GitDiffRow.rowsOf(diffFile ?? null)).toEqual([
      new GitDiffRow(GitDiffRowKind.Meta, "@@ -1,1 +1,2 @@"),
      new GitDiffRow(GitDiffRowKind.Context, " a"),
      new GitDiffRow(GitDiffRowKind.Removed, "-b"),
      new GitDiffRow(GitDiffRowKind.Added, "+c"),
      new GitDiffRow(GitDiffRowKind.Meta, "\\ No newline at end of file")
    ]);
  });

  it("says so for a missing file, a binary file, a file with no hunks and a cut diff", () => {
    const cut: DiffFile = file(false, [new DiffHunk(4, 0, 4, 1, "f()", [new DiffLine(LineKind.Added, null, 4, "x")])], true);

    expect(GitDiffRow.rowsOf(null)).toEqual([new GitDiffRow(GitDiffRowKind.Meta, "Git shows no lines for this file.")]);
    expect(GitDiffRow.rowsOf(file(true, [], false))).toEqual([new GitDiffRow(GitDiffRowKind.Meta, "Binary file: no lines to show.")]);
    expect(GitDiffRow.rowsOf(file(false, [], false))).toEqual([new GitDiffRow(GitDiffRowKind.Meta, "Git shows no lines for this file.")]);
    expect(GitDiffRow.rowsOf(cut).map(t => t.text)).toEqual(["@@ -4,0 +4,1 @@ f()", "+x", "The diff is cut short here."]);
  });
});
