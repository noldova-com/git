/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type DiffFile, type DiffLine, FileChange, LineKind } from "@noldova/git.protocol";

import { GitDiffRowKind } from "../enums/git-diff-row-kind.ts";
import { Resources } from "../../resources.ts";

export class GitDiffRow {
  public readonly kind: GitDiffRowKind;
  public readonly text: string;
  public readonly line: number | null;
  public readonly hunk: readonly number[];

  public constructor(kind: GitDiffRowKind, text: string, line: number | null = null, hunk: readonly number[] = []) {
    this.kind = kind;
    this.text = text;
    this.line = line;
    this.hunk = hunk;
  }

  public static rowsOf(file: DiffFile | null): readonly GitDiffRow[] {
    if (Object.isNull(file))
      return [new GitDiffRow(GitDiffRowKind.Meta, Resources.noDiff)];
    if (file.binary)
      return [new GitDiffRow(GitDiffRowKind.Meta, Resources.binaryDiff)];
    const choosable: boolean = GitDiffRow.isChoosable(file);
    const rows: GitDiffRow[] = [];
    let index: number = 0;
    for (const hunk of file.hunks) {
      const lines: GitDiffRow[] = hunk.lines.map(t => GitDiffRow.rowOf(t, choosable ? index++ : null));
      const changes: number[] = lines.flatMap(t => Object.isNull(t.line) ? [] : [t.line]);
      rows.push(new GitDiffRow(GitDiffRowKind.Meta, Resources.formatHunk(hunk.oldStart, hunk.oldCount, hunk.newStart, hunk.newCount, hunk.header), null, changes), ...lines);
    }
    if (file.truncated)
      rows.push(new GitDiffRow(GitDiffRowKind.Meta, Resources.diffCut));
    return rows.length === 0 ? [new GitDiffRow(GitDiffRowKind.Meta, Resources.noDiff)] : rows;
  }

  private static isChoosable(file: DiffFile): boolean {
    return file.change === FileChange.Modified && !file.truncated && Object.isNull(file.submodule) && Object.isUndefined(file.pathBytes) && file.oldMode === file.newMode;
  }

  private static rowOf(line: DiffLine, index: number | null): GitDiffRow {
    switch (line.kind) {
      case LineKind.Added:
        return new GitDiffRow(GitDiffRowKind.Added, `${Resources.addedPrefix}${line.text}`, index);
      case LineKind.Removed:
        return new GitDiffRow(GitDiffRowKind.Removed, `${Resources.removedPrefix}${line.text}`, index);
      case LineKind.NoNewlineAtEnd:
        return new GitDiffRow(GitDiffRowKind.Meta, Resources.noNewlineAtEnd);
      default:
        return new GitDiffRow(GitDiffRowKind.Context, `${Resources.contextPrefix}${line.text}`);
    }
  }
}
