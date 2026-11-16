/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type DiffFile, type DiffLine, LineKind } from "@noldova/git.protocol";

import { GitDiffRowKind } from "../enums/git-diff-row-kind.ts";
import { Resources } from "../../resources.ts";

export class GitDiffRow {
  public readonly kind: GitDiffRowKind;
  public readonly text: string;

  public constructor(kind: GitDiffRowKind, text: string) {
    this.kind = kind;
    this.text = text;
  }

  public static rowsOf(file: DiffFile | null): readonly GitDiffRow[] {
    if (file === null)
      return [new GitDiffRow(GitDiffRowKind.Meta, Resources.noDiff)];
    if (file.binary)
      return [new GitDiffRow(GitDiffRowKind.Meta, Resources.binaryDiff)];
    const rows: GitDiffRow[] = [];
    for (const hunk of file.hunks) {
      rows.push(new GitDiffRow(GitDiffRowKind.Meta, Resources.formatHunk(hunk.oldStart, hunk.oldCount, hunk.newStart, hunk.newCount, hunk.header)));
      rows.push(...hunk.lines.map(t => GitDiffRow.rowOf(t)));
    }
    if (file.truncated)
      rows.push(new GitDiffRow(GitDiffRowKind.Meta, Resources.diffCut));
    return rows.length === 0 ? [new GitDiffRow(GitDiffRowKind.Meta, Resources.noDiff)] : rows;
  }

  private static rowOf(line: DiffLine): GitDiffRow {
    switch (line.kind) {
      case LineKind.Added:
        return new GitDiffRow(GitDiffRowKind.Added, `${Resources.addedPrefix}${line.text}`);
      case LineKind.Removed:
        return new GitDiffRow(GitDiffRowKind.Removed, `${Resources.removedPrefix}${line.text}`);
      case LineKind.NoNewlineAtEnd:
        return new GitDiffRow(GitDiffRowKind.Meta, Resources.noNewlineAtEnd);
      default:
        return new GitDiffRow(GitDiffRowKind.Context, `${Resources.contextPrefix}${line.text}`);
    }
  }
}
