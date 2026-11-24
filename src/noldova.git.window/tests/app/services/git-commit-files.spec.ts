/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DiffFile, DiffHunk, DiffLine, FileChange, LineKind } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { GitFileLayout } from "../../../src/app/enums/git-file-layout.ts";
import type { GitCommitFileRow } from "../../../src/app/models/git-commit-file-row.ts";
import { GitCommitFiles } from "../../../src/app/services/git-commit-files.ts";

describe("GitCommitFiles", () => {
  const fileOf = (path: string, change: FileChange, added: number, removed: number, options: { readonly from?: string; readonly binary?: boolean; readonly similarity?: number } = {}): DiffFile => {
    const lines: DiffLine[] = [
      ...Array.from({ length: added }, () => new DiffLine(LineKind.Added, null, 1, "+")),
      ...Array.from({ length: removed }, () => new DiffLine(LineKind.Removed, 1, null, "-")),
      new DiffLine(LineKind.Context, 1, 1, " ")
    ];
    return new DiffFile(path, undefined, options.from ?? path, undefined, change, null, null, options.binary ?? false, null,
      options.binary === true ? [] : [new DiffHunk(1, 1, 1, 1, "", lines)], false, options.similarity ?? null);
  };
  const files: readonly DiffFile[] = [
    fileOf("src/services/reader.ts", FileChange.Modified, 14, 5),
    fileOf("README.md", FileChange.Modified, 1, 1),
    fileOf("src/services/parser.ts", FileChange.Added, 38, 0),
    fileOf("tests/log-fixture.ts", FileChange.Renamed, 0, 0, { from: "tests/log.fixture.ts", similarity: 92 }),
    fileOf("assets/logo.png", FileChange.Added, 0, 0, { binary: true })
  ];
  const shown = (rows: readonly GitCommitFileRow[]): readonly string[] => rows.map(t => t.isFolder
    ? `${"  ".repeat(t.depth)}+${t.name}`
    : `${"  ".repeat(t.depth)}${t.letter} ${t.name}${t.from.length > 0 ? ` <${t.from}` : ""} ${t.added ?? "x"}/${t.removed ?? "x"}`);

  it("shows each folder by name with its files under it, and the top's files last, a rename's letter with its similarity", () => {
    expect(shown(GitCommitFiles.rowsOf(files, GitFileLayout.Folders, new Set()))).toEqual([
      "+assets", "  A logo.png x/x",
      "+src/services", "  M reader.ts 14/5", "  A parser.ts 38/0",
      "+tests", "  R 92% log-fixture.ts <tests/log.fixture.ts 0/0",
      "M README.md 1/1"
    ]);
  });

  it("leaves a closed folder's files out, and lists whole paths without folders", () => {
    expect(shown(GitCommitFiles.rowsOf(files, GitFileLayout.Folders, new Set(["src/services", "tests"])))).toEqual([
      "+assets", "  A logo.png x/x", "+src/services", "+tests", "M README.md 1/1"
    ]);
    expect(shown(GitCommitFiles.rowsOf(files.slice(0, 2), GitFileLayout.List, new Set()))).toEqual(["M src/services/reader.ts 14/5", "M README.md 1/1"]);
  });

  it("nests the folders in a tree, a folder holding only one folder shown with it", () => {
    expect(shown(GitCommitFiles.rowsOf([...files, fileOf("src/main.ts", FileChange.Modified, 2, 0)], GitFileLayout.Tree, new Set()))).toEqual([
      "+assets", "  A logo.png x/x",
      "+src", "  +services", "    M reader.ts 14/5", "    A parser.ts 38/0", "  M main.ts 2/0",
      "+tests", "  R 92% log-fixture.ts <tests/log.fixture.ts 0/0",
      "M README.md 1/1"
    ]);
  });

  it("adds up the lines every file adds and removes", () => {
    expect(GitCommitFiles.totalsOf(files)).toEqual([53, 6]);
  });
});
