/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const PredictionAction = {
  Merge: "Merge",
  CherryPick: "CherryPick",
  Revert: "Revert"
} as const;

export type PredictionAction = (typeof PredictionAction)[keyof typeof PredictionAction];
