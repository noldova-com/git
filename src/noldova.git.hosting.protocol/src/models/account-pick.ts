/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";

import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";

export class AccountPick {
  private static readonly FIELDS: readonly string[] = [Resources.hostField, Resources.pathField, Resources.accountField];

  public readonly host: string;
  public readonly path: string;
  public readonly account: number;

  public constructor(host: string, path: string, account: number, reader?: JsonReader) {
    FieldCheck.requireText(host, Resources.hostField, reader);
    FieldCheck.requirePath(path, Resources.pathField, reader);
    FieldCheck.requirePositive(account, Resources.accountField, reader);

    this.host = host;
    this.path = path;
    this.account = account;
  }

  public static fromJson(value: unknown, path?: string): AccountPick {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, AccountPick.FIELDS);
    return new AccountPick(reader.readString(Resources.hostField), reader.readString(Resources.pathField), reader.readInteger(Resources.accountField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.hostField]: this.host, [Resources.pathField]: this.path, [Resources.accountField]: this.account };
  }
}
