/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";
import { AccountPick } from "@noldova/git.hosting.protocol";

import { Resources } from "../resources.ts";
import { KeptAccount } from "./kept-account.ts";

export class KeptAccounts {
  public readonly accounts: readonly KeptAccount[];
  public readonly picks: readonly AccountPick[];

  public constructor(accounts: readonly KeptAccount[], picks: readonly AccountPick[]) {
    this.accounts = accounts;
    this.picks = picks;
  }

  public static fromJson(value: unknown): KeptAccounts {
    const reader: JsonReader = JsonReader.fromValue(value);
    return new KeptAccounts(reader.readObjectArray(Resources.accountsField).map(t => KeptAccount.fromJson(t.toJson())),
      reader.readObjectArray(Resources.picksField).map(t => AccountPick.fromJson(t.toJson(), t.path)));
  }

  public toJson(): JsonObject {
    return { [Resources.accountsField]: this.accounts.map(t => t.toJson()), [Resources.picksField]: this.picks.map(t => t.toJson()) };
  }
}
