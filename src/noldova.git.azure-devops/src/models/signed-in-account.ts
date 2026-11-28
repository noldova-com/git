/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AzureCredential } from "./azure-credential.ts";

export class SignedInAccount {
  public readonly id: number;
  public readonly login: string;
  public readonly organization: string;
  public readonly token: AzureCredential;

  public constructor(id: number, login: string, organization: string, token: AzureCredential) {
    this.id = id;
    this.login = login;
    this.organization = organization;
    this.token = token;
  }
}
