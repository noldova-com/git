/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";
import { HostAccount } from "@noldova/git.hosting.protocol";

import { Resources } from "../resources.ts";

export class KeptSignIn {
  public readonly token: string;
  public readonly account: HostAccount;

  public constructor(token: string, account: HostAccount) {
    this.token = token;
    this.account = account;
  }

  public static fromJson(value: unknown): KeptSignIn {
    const reader: JsonReader = JsonReader.fromValue(value);
    const account: JsonReader = reader.readObject(Resources.accountField);
    return new KeptSignIn(reader.readNonBlankString(Resources.tokenField), new HostAccount(account.readNonBlankString(Resources.loginField),
      account.readNullableString(Resources.nameField), null, account.readStringArray(Resources.scopesField)));
  }

  public toJson(): JsonObject {
    return { [Resources.tokenField]: this.token, [Resources.accountField]: this.account.toJson() };
  }
}
