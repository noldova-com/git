/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DiffFile, DiffHunk, DiffLine, FileChange, LineKind, SubmoduleChange } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { GitDiffRowKind } from "../../../src/app/enums/git-diff-row-kind.ts";
import { GitDiffRow } from "../../../src/app/models/git-diff-row.ts";
import { FixtureLine, GitFixtures } from "../../fixtures/git-fixtures.fixture.ts";

describe("GitDiffRow", () => {
  const file = (binary: boolean, hunks: readonly DiffHunk[], truncated: boolean): DiffFile =>
    new DiffFile("a.ts", undefined, "a.ts", undefined, FileChange.Modified, null, null, binary, null, hunks, truncated);

  it("draws a hunk's header, then each line with its sign, and a missing newline as a note", () => {
    const [diffFile] = GitFixtures.diff("a.ts", new FixtureLine(LineKind.Context, "a"), new FixtureLine(LineKind.Removed, "b"), new FixtureLine(LineKind.Added, "c"), new FixtureLine(LineKind.NoNewlineAtEnd, "")).files;

    expect(GitDiffRow.rowsOf(diffFile ?? null)).toEqual([
      new GitDiffRow(GitDiffRowKind.Meta, "@@ -1,1 +1,2 @@", null, [1, 2]),
      new GitDiffRow(GitDiffRowKind.Context, " a"),
      new GitDiffRow(GitDiffRowKind.Removed, "-b", 1),
      new GitDiffRow(GitDiffRowKind.Added, "+c", 2),
      new GitDiffRow(GitDiffRowKind.Meta, "\\ No newline at end of file")
    ]);
  });

  it("numbers lines across hunks as the runtime counts them, every line from 0, and numbers none in a file whose lines can't be chosen", () => {
    const hunks: readonly DiffHunk[] = [
      new DiffHunk(1, 2, 1, 2, "", [new DiffLine(LineKind.Context, 1, 1, "a"), new DiffLine(LineKind.Removed, 2, null, "b"), new DiffLine(LineKind.Added, null, 2, "c")]),
      new DiffHunk(9, 1, 9, 1, "", [new DiffLine(LineKind.Removed, 9, null, "d"), new DiffLine(LineKind.Added, null, 9, "e"), new DiffLine(LineKind.NoNewlineAtEnd, null, null, "")])
    ];
    const numbers = (changed: DiffFile): readonly (number | readonly number[] | null)[] => GitDiffRow.rowsOf(changed).map(t => t.kind === GitDiffRowKind.Meta ? t.hunk : t.line);
    const other = (change: FileChange, oldMode: string | null, newMode: string | null, pathBytes?: string, submodule: SubmoduleChange | null = null): DiffFile =>
      new DiffFile("a.ts", pathBytes, "a.ts", pathBytes, change, oldMode, newMode, false, submodule, hunks, false);
    const none: readonly (number | readonly number[] | null)[] = [[], null, null, null, [], null, null, []];

    expect(numbers(file(false, hunks, false))).toEqual([[1, 2], null, 1, 2, [3, 4], 3, 4, []]);
    expect(numbers(other(FileChange.Modified, "100644", "100644"))).toEqual([[1, 2], null, 1, 2, [3, 4], 3, 4, []]);
    expect([
      numbers(other(FileChange.Added, null, null)), numbers(other(FileChange.Modified, "100644", "100755")), numbers(other(FileChange.Modified, null, null, "YQ==")),
      numbers(other(FileChange.Modified, null, null, undefined, new SubmoduleChange("1".repeat(40), "2".repeat(40))))
    ]).toEqual([none, none, none, none]);
  });

  it("says so for a missing file, a binary file, a file with no hunks and a cut diff", () => {
    const cut: DiffFile = file(false, [new DiffHunk(4, 0, 4, 1, "f()", [new DiffLine(LineKind.Added, null, 4, "x")])], true);

    expect(GitDiffRow.rowsOf(null)).toEqual([new GitDiffRow(GitDiffRowKind.Meta, "Git shows no lines for this file.")]);
    expect(GitDiffRow.rowsOf(file(true, [], false))).toEqual([new GitDiffRow(GitDiffRowKind.Meta, "Binary file: no lines to show.")]);
    expect(GitDiffRow.rowsOf(file(false, [], false))).toEqual([new GitDiffRow(GitDiffRowKind.Meta, "Git shows no lines for this file.")]);
    expect(GitDiffRow.rowsOf(cut).map(t => t.text)).toEqual(["@@ -4,0 +4,1 @@ f()", "+x", "The diff is cut short here."]);
  });
});
