/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";
import "@noldova/context.core";

import type { GitBranchView } from "../models/git-branch-view.ts";
import type { GitCommitView } from "../models/git-commit-view.ts";

/**
 * What the person is looking at without switching: the branch the side panel picked, which the history scrolls to, and the commit each folder's
 * history selected, which the Commit view shows; each folder keeps its own, so going back to a history finds its commit still selected.
 */
export class GitViewing {
  public static readonly branch: WritableSignal<GitBranchView | null> = signal<GitBranchView | null>(null);
  private static readonly commits: WritableSignal<ReadonlyMap<string, GitCommitView>> = signal<ReadonlyMap<string, GitCommitView>>(new Map());

  /** The branch a folder's side panel picked, or `null`. */
  public static branchOf(folder: string | null): GitBranchView | null {
    const view: GitBranchView | null = GitViewing.branch();
    return !Object.isNull(view) && view.folder === folder ? view : null;
  }

  /** The commit a folder's history selected, or `null` when it shows the changes. */
  public static commitOf(folder: string | null): GitCommitView | null {
    return Object.isNull(folder) ? null : GitViewing.commits().get(folder) ?? null;
  }

  /** Selects a commit in its folder's history, leaving the other folders' selections as they are. */
  public static show(view: GitCommitView): void {
    GitViewing.commits.update(t => new Map([...t, [view.folder, view]]));
  }

  /** Selects a folder's changes in place of its commit. */
  public static showChanges(folder: string | null): void {
    if (Object.isNull(folder) || !GitViewing.commits().has(folder))
      return;
    GitViewing.commits.update(t => new Map([...t].filter(([key]) => key !== folder)));
  }
}
