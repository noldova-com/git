/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type DiffFile, FileChange, LineKind } from "@noldova/git.protocol";

import type { GitFileLayout } from "../enums/git-file-layout.ts";
import { GitCommitFileRow } from "../models/git-commit-file-row.ts";
import { GitPathLayout } from "./git-path-layout.ts";
import { Resources } from "../../resources.ts";

/** Lays a commit's changed files out as rows, in one of the three layouts. */
export class GitCommitFiles {
  /** The rows to show; a closed folder's rows are left out. */
  public static rowsOf(files: readonly DiffFile[], layout: GitFileLayout, closed: ReadonlySet<string>): GitCommitFileRow[] {
    return GitPathLayout.layout(files, t => t.path, layout, closed).map(t => t.item === null
      ? new GitCommitFileRow(t.folder, t.name, "", true, t.depth, "", null, null)
      : GitCommitFiles.fileOf(t.item, t.name, t.depth));
  }

  /** The lines all the files add and remove. */
  public static totalsOf(files: readonly DiffFile[]): readonly [number, number] {
    return files.map(t => GitCommitFiles.countsOf(t)).reduce(([added, removed], [a, r]) => [added + a, removed + r], [0, 0]);
  }

  private static fileOf(file: DiffFile, name: string, depth: number): GitCommitFileRow {
    const moved: boolean = file.change === FileChange.Renamed || file.change === FileChange.Copied;
    const [added, removed] = GitCommitFiles.countsOf(file);
    const hasLines: boolean = !file.binary && file.submodule === null;
    const letter: string = Resources.changeLetters[file.change];
    return new GitCommitFileRow(file.path, name, moved ? file.oldPath : "", false, depth, file.similarity === null ? letter : Resources.formatSimilarity(letter, file.similarity),
      hasLines ? added : null, hasLines ? removed : null);
  }

  private static countsOf(file: DiffFile): readonly [number, number] {
    const lines = file.hunks.flatMap(t => t.lines);
    return [lines.filter(t => t.kind === LineKind.Added).length, lines.filter(t => t.kind === LineKind.Removed).length];
  }
}
