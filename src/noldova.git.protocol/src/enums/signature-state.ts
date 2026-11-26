/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const SignatureState = {
  Verified: "Verified",
  Unverified: "Unverified",
  None: "None"
} as const;

export type SignatureState = (typeof SignatureState)[keyof typeof SignatureState];
