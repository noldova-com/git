/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** What a write would do, worked out without touching the working folder or the index. */
export const PredictionOutcome = {
  UpToDate: "UpToDate",
  FastForward: "FastForward",
  Clean: "Clean",
  Conflicts: "Conflicts",
  Unavailable: "Unavailable"
} as const;

export type PredictionOutcome = (typeof PredictionOutcome)[keyof typeof PredictionOutcome];
