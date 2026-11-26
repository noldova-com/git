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

export class GitViewing {
  public static readonly branch: WritableSignal<GitBranchView | null> = signal<GitBranchView | null>(null);
  private static readonly commits: WritableSignal<ReadonlyMap<string, GitCommitView>> = signal<ReadonlyMap<string, GitCommitView>>(new Map());

  public static branchOf(folder: string | null): GitBranchView | null {
    const view: GitBranchView | null = GitViewing.branch();
    return !Object.isNull(view) && view.folder === folder ? view : null;
  }

  public static commitOf(folder: string | null): GitCommitView | null {
    return Object.isNull(folder) ? null : GitViewing.commits().get(folder) ?? null;
  }

  public static show(view: GitCommitView): void {
    GitViewing.commits.update(t => new Map([...t, [view.folder, view]]));
  }

  public static showChanges(folder: string | null): void {
    if (Object.isNull(folder) || !GitViewing.commits().has(folder))
      return;
    GitViewing.commits.update(t => new Map([...t].filter(([key]) => key !== folder)));
  }
}
