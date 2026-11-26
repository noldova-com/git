/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const SigningFormat = {
  OpenPgp: "OpenPgp",
  Ssh: "Ssh",
  X509: "X509"
} as const;

export type SigningFormat = (typeof SigningFormat)[keyof typeof SigningFormat];
