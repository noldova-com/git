/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { HostReviewRequestList } from "@noldova/git.hosting.protocol";

import type { IAccountRead } from "../interfaces/i-account-read.ts";
import type { SignedInAccount } from "./signed-in-account.ts";

export class AccountReviewRequests implements IAccountRead {
  public readonly account: SignedInAccount;
  public readonly list: HostReviewRequestList;

  public constructor(account: SignedInAccount, list: HostReviewRequestList) {
    this.account = account;
    this.list = list;
  }
}
