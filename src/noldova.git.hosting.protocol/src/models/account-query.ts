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

export class AccountQuery {
  private static readonly FIELDS: readonly string[] = [Resources.accountField];

  public readonly account: number;

  public constructor(account: number, reader?: JsonReader) {
    FieldCheck.requirePositive(account, Resources.accountField, reader);

    this.account = account;
  }

  public static fromJson(value: unknown, path?: string): AccountQuery {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, AccountQuery.FIELDS);
    return new AccountQuery(reader.readInteger(Resources.accountField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.accountField]: this.account };
  }
}
