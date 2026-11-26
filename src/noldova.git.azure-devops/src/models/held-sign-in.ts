/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AzureCredential } from "./azure-credential.ts";

export class HeldSignIn {
  public readonly token: AzureCredential;
  public readonly organization: string;

  public constructor(token: AzureCredential, organization: string) {
    this.token = token;
    this.organization = organization;
  }
}
