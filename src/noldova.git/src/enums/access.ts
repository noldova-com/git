/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const Access = {
  Read: "Read",
  Write: "Write"
} as const;

export type Access = (typeof Access)[keyof typeof Access];
