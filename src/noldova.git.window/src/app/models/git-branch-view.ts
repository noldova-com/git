/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type GitGraphCommit, RefKind } from "@noldova/git.protocol";

export class GitBranchView {
  public readonly folder: string;
  public readonly branch: string;
  public readonly isRemote: boolean;
  public readonly commitId: string;

  public constructor(folder: string, branch: string, isRemote: boolean, commitId: string = "") {
    this.folder = folder;
    this.branch = branch;
    this.isRemote = isRemote;
    this.commitId = commitId;
  }

  public isAt(commit: GitGraphCommit): boolean {
    if (this.commitId !== "")
      return commit.commit.id === this.commitId;
    const kind: RefKind = this.isRemote ? RefKind.RemoteBranch : RefKind.Branch;
    return commit.refs.some(t => t.kind === kind && t.name === this.branch);
  }
}
