/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const WorkItemCategory = {
  Proposed: "Proposed",
  InProgress: "InProgress",
  Resolved: "Resolved",
  Completed: "Completed",
  Removed: "Removed"
} as const;

export type WorkItemCategory = (typeof WorkItemCategory)[keyof typeof WorkItemCategory];
