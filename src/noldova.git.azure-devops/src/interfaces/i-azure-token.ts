/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AzureCredential } from "../models/azure-credential.ts";

export interface IAzureToken {
  readonly token: AzureCredential | null;
  readonly organization: string | null;
  refusedAsync(token: AzureCredential): Promise<void>;
}
