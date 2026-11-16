/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const SignInFailure = {
  Expired: "Expired",
  Denied: "Denied",
  Revoked: "Revoked",
  Unreachable: "Unreachable",
  Refused: "Refused",
  Unkept: "Unkept",
  Unforgotten: "Unforgotten"
} as const;

export type SignInFailure = (typeof SignInFailure)[keyof typeof SignInFailure];
