/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const WorkItemScope = {
  Mine: "Mine",
  Ids: "Ids"
} as const;

export type WorkItemScope = (typeof WorkItemScope)[keyof typeof WorkItemScope];
