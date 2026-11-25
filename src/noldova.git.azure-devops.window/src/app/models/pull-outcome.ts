/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** What pulling after a merge leaves to show: a note when it pulled or a failure when it couldn't, each null when it has none. */
export class PullOutcome {
  public readonly note: string | null;
  public readonly failure: string | null;

  public constructor(note: string | null, failure: string | null) {
    this.note = note;
    this.failure = failure;
  }
}
