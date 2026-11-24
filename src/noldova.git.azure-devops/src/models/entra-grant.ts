/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class EntraGrant {
  public readonly accessToken: string;
  public readonly refreshToken: string;
  public readonly expiresIn: number;
  public readonly canWriteCode: boolean;

  public constructor(accessToken: string, refreshToken: string, expiresIn: number, canWriteCode: boolean = true) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.expiresIn = expiresIn;
    this.canWriteCode = canWriteCode;
  }
}
