/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** A sign-in with a personal access token the window sent: the token and the organization it signs in to. */
export class TokenSignIn {
  public readonly token: string;
  public readonly organization: string;

  public constructor(token: string, organization: string) {
    this.token = token;
    this.organization = organization;
  }
}
