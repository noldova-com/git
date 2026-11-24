/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitGraphCommit } from "@noldova/git.protocol";

/** A commit the history has selected, which the Git panel shows in place of the changes: the repository's folder and the commit. */
export class GitCommitView {
  public readonly folder: string;
  public readonly commit: GitGraphCommit;

  public constructor(folder: string, commit: GitGraphCommit) {
    this.folder = folder;
    this.commit = commit;
  }
}
