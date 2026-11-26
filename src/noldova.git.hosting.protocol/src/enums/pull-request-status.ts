/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const PullRequestStatus = {
  Failed: "Failed",
  Pending: "Pending",
  Succeeded: "Succeeded",
  None: "None"
} as const;

export type PullRequestStatus = (typeof PullRequestStatus)[keyof typeof PullRequestStatus];
