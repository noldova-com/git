/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** The format git signs a commit in, as `gpg.format` names it: `openpgp`, git's default, `ssh` or `x509`. */
export const SigningFormat = {
  OpenPgp: "OpenPgp",
  Ssh: "Ssh",
  X509: "X509"
} as const;

export type SigningFormat = (typeof SigningFormat)[keyof typeof SigningFormat];
