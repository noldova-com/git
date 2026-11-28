/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AzureCredential } from "../models/azure-credential.ts";

export interface IAzureTokens {
  readonly isSignedIn: boolean;
  tokenFor(organization: string, host?: string | null, path?: string | null): AzureCredential | null;
  holds(token: AzureCredential): boolean;
  refusedAsync(token: AzureCredential): Promise<void>;
  readyAsync(): Promise<void>;
}
