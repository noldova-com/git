/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type GitGraphCommit, RefKind } from "@noldova/git.protocol";

/**
 * Where the history scrolls to without switching: a branch the side panel picked, by its whole name and whether it is a remote's, or a commit the Git
 * panel picked, such as a parent, by its id; in the repository's folder.
 */
export class GitBranchView {
  public readonly folder: string;
  /** The branch's whole name, or empty for a commit. */
  public readonly branch: string;
  public readonly isRemote: boolean;
  /** The commit's whole id, or empty for a branch. */
  public readonly commitId: string;

  public constructor(folder: string, branch: string, isRemote: boolean, commitId: string = "") {
    this.folder = folder;
    this.branch = branch;
    this.isRemote = isRemote;
    this.commitId = commitId;
  }

  /** Whether the branch points at the commit, or it is the commit. */
  public isAt(commit: GitGraphCommit): boolean {
    if (this.commitId !== "")
      return commit.commit.id === this.commitId;
    const kind: RefKind = this.isRemote ? RefKind.RemoteBranch : RefKind.Branch;
    return commit.refs.some(t => t.kind === kind && t.name === this.branch);
  }
}
