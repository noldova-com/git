/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const FailureCode = {
  Refused: "Refused",
  Denied: "Denied",
  Expired: "Expired",
  Withdrawn: "Withdrawn",
  Stale: "Stale",
  TimedOut: "TimedOut",
  TooLarge: "TooLarge",
  Unavailable: "Unavailable",
  NotRepository: "NotRepository",
  Git: "Git"
} as const;

export type FailureCode = (typeof FailureCode)[keyof typeof FailureCode];
