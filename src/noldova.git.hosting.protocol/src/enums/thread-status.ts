/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const ThreadStatus = {
  Active: "Active",
  Pending: "Pending",
  Resolved: "Resolved",
  WontFix: "WontFix",
  ByDesign: "ByDesign",
  Closed: "Closed",
  None: "None"
} as const;

export type ThreadStatus = (typeof ThreadStatus)[keyof typeof ThreadStatus];
