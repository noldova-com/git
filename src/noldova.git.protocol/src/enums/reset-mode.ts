/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const ResetMode = {
  Soft: "Soft",
  Mixed: "Mixed",
  Keep: "Keep"
} as const;

export type ResetMode = (typeof ResetMode)[keyof typeof ResetMode];
