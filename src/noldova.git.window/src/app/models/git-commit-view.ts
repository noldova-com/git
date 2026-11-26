/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitGraphCommit } from "@noldova/git.protocol";

export class GitCommitView {
  public readonly folder: string;
  public readonly commit: GitGraphCommit;

  public constructor(folder: string, commit: GitGraphCommit) {
    this.folder = folder;
    this.commit = commit;
  }
}
