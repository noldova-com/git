/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { HostAccount } from "@noldova/git.hosting.protocol";

export class AccountRead {
  public readonly account: HostAccount;
  public readonly avatarUrl: string | null;

  public constructor(account: HostAccount, avatarUrl: string | null) {
    this.account = account;
    this.avatarUrl = avatarUrl;
  }
}
