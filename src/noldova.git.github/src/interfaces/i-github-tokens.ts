/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SignedInAccount } from "../models/signed-in-account.ts";

export interface IGitHubTokens {
  readonly signedIn: readonly SignedInAccount[];
  signedInOn(host: string): readonly SignedInAccount[];
  serves(host: string): boolean;
  useUser(host: string, path: string, user: string | null): void;
  tokenForAsync(host: string, path: string, signal: AbortSignal): Promise<string | null>;
  holds(token: string): boolean;
  refusedAsync(token: string): Promise<void>;
}
