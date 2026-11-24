/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** Whether a commit's signature checks out against the keys the person trusts: `None` when the commit carries no signature. */
export const SignatureState = {
  Verified: "Verified",
  Unverified: "Unverified",
  None: "None"
} as const;

export type SignatureState = (typeof SignatureState)[keyof typeof SignatureState];
