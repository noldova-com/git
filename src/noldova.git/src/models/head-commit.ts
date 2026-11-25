/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** The branch at `HEAD`, or `HEAD` when it is detached, and the commit at `HEAD`, or `null` when the branch has no commit yet. */
export class HeadCommit {
  public readonly branch: string;
  public readonly commit: string | null;

  public constructor(branch: string, commit: string | null) {
    this.branch = branch;
    this.commit = commit;
  }
}
