/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const CheckState = {
  Queued: "Queued",
  Running: "Running",
  Succeeded: "Succeeded",
  Failed: "Failed",
  Neutral: "Neutral"
} as const;

export type CheckState = (typeof CheckState)[keyof typeof CheckState];
