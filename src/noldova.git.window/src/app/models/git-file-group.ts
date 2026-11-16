/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FileState, type StatusEntry } from "@noldova/git.protocol";

import { GitFileGroupKind } from "../enums/git-file-group-kind.ts";
import { GitFileRow } from "./git-file-row.ts";

export class GitFileGroup {
  public readonly kind: GitFileGroupKind;
  public readonly rows: readonly GitFileRow[];

  public constructor(kind: GitFileGroupKind, rows: readonly GitFileRow[]) {
    this.kind = kind;
    this.rows = rows;
  }

  public static groupsOf(entries: readonly StatusEntry[]): readonly GitFileGroup[] {
    const rows: Record<GitFileGroupKind, GitFileRow[]> = { [GitFileGroupKind.Conflicts]: [], [GitFileGroupKind.Staged]: [], [GitFileGroupKind.Changes]: [] };
    for (const entry of entries)
      if (entry.conflict !== null)
        rows[GitFileGroupKind.Conflicts].push(new GitFileRow(GitFileGroupKind.Conflicts, entry));
      else {
        if (GitFileGroup.isChange(entry.index) && entry.index !== FileState.Untracked)
          rows[GitFileGroupKind.Staged].push(new GitFileRow(GitFileGroupKind.Staged, entry));
        if (GitFileGroup.isChange(entry.worktree))
          rows[GitFileGroupKind.Changes].push(new GitFileRow(GitFileGroupKind.Changes, entry));
      }
    return [GitFileGroupKind.Conflicts, GitFileGroupKind.Staged, GitFileGroupKind.Changes].filter(t => rows[t].length > 0).map(t => new GitFileGroup(t, rows[t]));
  }

  private static isChange(state: FileState): boolean {
    return state !== FileState.Unmodified && state !== FileState.Ignored;
  }
}
