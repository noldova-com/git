/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class TokenSignIn {
  public readonly token: string;
  public readonly organization: string;

  public constructor(token: string, organization: string) {
    this.token = token;
    this.organization = organization;
  }
}
