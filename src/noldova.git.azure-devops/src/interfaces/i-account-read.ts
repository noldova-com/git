/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SignedInAccount } from "../models/signed-in-account.ts";

export interface IAccountRead {
  readonly account: SignedInAccount;
}
