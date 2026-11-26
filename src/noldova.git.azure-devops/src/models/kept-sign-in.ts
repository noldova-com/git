/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";
import { HostAccount } from "@noldova/git.hosting.protocol";

import { SignInKind } from "../enums/sign-in-kind.ts";
import { Resources } from "../resources.ts";

export class KeptSignIn {
  private static readonly KINDS: readonly SignInKind[] = Object.values(SignInKind);

  public readonly kind: SignInKind;
  public readonly token: string;
  public readonly organization: string;
  public readonly account: HostAccount;

  public constructor(kind: SignInKind, token: string, organization: string, account: HostAccount) {
    this.kind = kind;
    this.token = token;
    this.organization = organization;
    this.account = account;
  }

  public static fromJson(value: unknown): KeptSignIn {
    const reader: JsonReader = JsonReader.fromValue(value);
    const account: JsonReader = reader.readObject(Resources.accountField);
    return new KeptSignIn(reader.hasField(Resources.kindField) ? reader.readOneOf(Resources.kindField, KeptSignIn.KINDS) : SignInKind.Token,
      reader.readNonBlankString(Resources.tokenField), reader.readNonBlankString(Resources.organizationField),
      new HostAccount(account.readNonBlankString(Resources.loginField), account.readNullableString(Resources.nameField), null,
        account.readStringArray(Resources.scopesField)));
  }

  public toJson(): JsonObject {
    return { [Resources.kindField]: this.kind, [Resources.tokenField]: this.token, [Resources.organizationField]: this.organization, [Resources.accountField]: this.account.toJson() };
  }
}
