/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const PredictionOutcome = {
  UpToDate: "UpToDate",
  FastForward: "FastForward",
  Clean: "Clean",
  Conflicts: "Conflicts",
  Unavailable: "Unavailable"
} as const;

export type PredictionOutcome = (typeof PredictionOutcome)[keyof typeof PredictionOutcome];
