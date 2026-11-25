/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AzureCredential } from "./azure-credential.ts";

/** The signed-in person's id in an organization, with the token it was read with, so a later sign-in reads it again. */
export class KnownReviewer {
  public readonly token: AzureCredential;
  public readonly id: string;

  public constructor(token: AzureCredential, id: string) {
    this.token = token;
    this.id = id;
  }
}
