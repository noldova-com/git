/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const PolicyState = {
  Queued: "Queued",
  Running: "Running",
  Approved: "Approved",
  Rejected: "Rejected",
  NotApplicable: "NotApplicable"
} as const;

export type PolicyState = (typeof PolicyState)[keyof typeof PolicyState];
