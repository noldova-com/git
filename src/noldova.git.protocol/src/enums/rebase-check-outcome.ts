/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** What a rebase step would do, worked out before the rebase starts, without touching the branch, the index or the working folder. */
export const RebaseCheckOutcome = {
  Clean: "Clean",
  Conflicts: "Conflicts",
  Folded: "Folded",
  Dropped: "Dropped",
  Unavailable: "Unavailable"
} as const;

export type RebaseCheckOutcome = (typeof RebaseCheckOutcome)[keyof typeof RebaseCheckOutcome];
