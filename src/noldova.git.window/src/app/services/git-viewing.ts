/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";

import type { GitBranchView } from "../models/git-branch-view.ts";
import type { GitCommitView } from "../models/git-commit-view.ts";

/** What the person is looking at without switching: the branch the side panel picked, which the history scrolls to, and the commit the history selected, which the Commit view shows. */
export class GitViewing {
  public static readonly branch: WritableSignal<GitBranchView | null> = signal<GitBranchView | null>(null);
  public static readonly commit: WritableSignal<GitCommitView | null> = signal<GitCommitView | null>(null);

  /** The branch a folder's side panel picked, or `null`. */
  public static branchOf(folder: string | null): GitBranchView | null {
    const view: GitBranchView | null = GitViewing.branch();
    return view !== null && view.folder === folder ? view : null;
  }

  /** The commit a folder's history selected, or `null` when it shows the changes. */
  public static commitOf(folder: string | null): GitCommitView | null {
    const view: GitCommitView | null = GitViewing.commit();
    return view !== null && view.folder === folder ? view : null;
  }
}
