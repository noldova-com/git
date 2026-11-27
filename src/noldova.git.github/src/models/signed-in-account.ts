/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class SignedInAccount {
  public readonly id: number;
  public readonly login: string;
  public readonly token: string;

  public constructor(id: number, login: string, token: string) {
    this.id = id;
    this.login = login;
    this.token = token;
  }
}
