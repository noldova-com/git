/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** The write a prediction is for: merging a commit into the current branch, or cherry-picking or reverting it there. */
export const PredictionAction = {
  Merge: "Merge",
  CherryPick: "CherryPick",
  Revert: "Revert"
} as const;

export type PredictionAction = (typeof PredictionAction)[keyof typeof PredictionAction];
