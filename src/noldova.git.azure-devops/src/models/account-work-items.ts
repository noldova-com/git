/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { HostWorkItemList } from "@noldova/git.hosting.protocol";

import type { SignedInAccount } from "./signed-in-account.ts";

export class AccountWorkItems {
  public readonly account: SignedInAccount;
  public readonly list: HostWorkItemList;

  public constructor(account: SignedInAccount, list: HostWorkItemList) {
    this.account = account;
    this.list = list;
  }
}
