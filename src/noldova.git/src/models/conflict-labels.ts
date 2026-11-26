/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ConflictLabels {
  public readonly ours: string;
  public readonly theirs: string;
  public readonly oursCommit: string | null;
  public readonly theirsCommit: string | null;

  public constructor(ours: string, theirs: string, oursCommit: string | null, theirsCommit: string | null) {
    this.ours = ours;
    this.theirs = theirs;
    this.oursCommit = oursCommit;
    this.theirsCommit = theirsCommit;
  }
}
