/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DiffScopeKind, FileState, type LineCounts, type StatusEntry } from "@noldova/git.protocol";

import { GitFileGroupKind } from "../enums/git-file-group-kind.ts";
import { GitFileTone } from "../enums/git-file-tone.ts";
import { Resources } from "../../resources.ts";

export class GitFileRow {
  public readonly group: GitFileGroupKind;
  public readonly path: string;
  public readonly directory: string;
  public readonly fileName: string;
  public readonly letter: string;
  public readonly tone: GitFileTone;
  public readonly counts: LineCounts | null;
  public readonly kind: string | null;
  public readonly scope: DiffScopeKind;

  public constructor(group: GitFileGroupKind, entry: StatusEntry) {
    const slash: number = entry.path.lastIndexOf(Resources.slash);
    const state: FileState = group === GitFileGroupKind.Staged ? entry.index : entry.worktree;

    this.group = group;
    this.path = entry.path;
    this.directory = GitFileRow.shortFolderOf(entry.path.slice(0, slash + 1));
    this.fileName = entry.path.slice(slash + 1);
    this.letter = entry.conflict === null ? Resources.stateLetters[state] : Resources.conflictLetter;
    this.tone = entry.conflict === null ? GitFileRow.toneOf(state) : GitFileTone.Conflict;
    this.counts = group === GitFileGroupKind.Staged ? entry.indexCounts : group === GitFileGroupKind.Changes ? entry.worktreeCounts : null;
    this.kind = entry.conflict === null ? null : Resources.conflictKinds[entry.conflict];
    this.scope = group === GitFileGroupKind.Staged ? DiffScopeKind.Staged : DiffScopeKind.Worktree;
  }

  public get key(): string {
    return Resources.formatRowKey(this.group, this.path);
  }

  private static shortFolderOf(directory: string): string {
    const head: string = directory.slice(0, directory.indexOf(Resources.slash) + 1);
    const rest: readonly string[] = directory.slice(head.length).split(Resources.slash).filter(t => t !== "");
    const kept: string[] = [];
    for (const name of rest.toReversed()) {
      const dot: number = name.lastIndexOf(Resources.dot);
      const short: string = dot > 0 ? name.slice(dot + 1) : name;
      if (kept.length > 0 && [short, ...kept].join(Resources.slash).length > Resources.folderTailLength)
        break;
      kept.unshift(short);
      if (short !== name)
        break;
    }
    const tail: string = kept.join(Resources.slash);
    return tail === rest.join(Resources.slash) ? directory : `${head}${Resources.ellipsis}${Resources.slash}${tail}${Resources.slash}`;
  }

  private static toneOf(state: FileState): GitFileTone {
    switch (state) {
      case FileState.Added:
        return GitFileTone.Added;
      case FileState.Deleted:
        return GitFileTone.Removed;
      case FileState.Untracked:
        return GitFileTone.Untracked;
      default:
        return GitFileTone.Modified;
    }
  }
}
