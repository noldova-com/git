/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const WorktreeState = {
  Pending: "Pending",
  Ready: "Ready"
} as const;

export type WorktreeState = (typeof WorktreeState)[keyof typeof WorktreeState];
