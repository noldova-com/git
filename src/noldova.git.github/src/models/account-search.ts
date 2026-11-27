/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ReviewSearchAnswer } from "./review-search-answer.ts";
import type { SignedInAccount } from "./signed-in-account.ts";

export class AccountSearch {
  public readonly account: SignedInAccount;
  public readonly answer: ReviewSearchAnswer;

  public constructor(account: SignedInAccount, answer: ReviewSearchAnswer) {
    this.account = account;
    this.answer = answer;
  }
}
