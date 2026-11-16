/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const SignInState = {
  SignedOut: "SignedOut",
  Waiting: "Waiting",
  SignedIn: "SignedIn"
} as const;

export type SignInState = (typeof SignInState)[keyof typeof SignInState];
