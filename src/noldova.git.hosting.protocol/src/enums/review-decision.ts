/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const ReviewDecision = {
  Waiting: "Waiting",
  ChangesRequested: "ChangesRequested",
  Approved: "Approved"
} as const;

export type ReviewDecision = (typeof ReviewDecision)[keyof typeof ReviewDecision];
