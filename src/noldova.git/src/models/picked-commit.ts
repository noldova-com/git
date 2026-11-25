/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** The commit a cherry-pick or revert takes: whether it is a merge, which needs a mainline, and its subject for the permission prompt. */
export class PickedCommit {
  public readonly isMerge: boolean;
  public readonly subject: string;

  public constructor(isMerge: boolean, subject: string) {
    this.isMerge = isMerge;
    this.subject = subject;
  }
}
