/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const RebaseCheckOutcome = {
  Clean: "Clean",
  Conflicts: "Conflicts",
  Folded: "Folded",
  Dropped: "Dropped",
  Unavailable: "Unavailable"
} as const;

export type RebaseCheckOutcome = (typeof RebaseCheckOutcome)[keyof typeof RebaseCheckOutcome];
