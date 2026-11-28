/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type JsonObject, JsonReader } from "@noldova/context.json";

import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";

export class RepositoryAccount {
  private static readonly FIELDS: readonly string[] = [Resources.accountField];

  public readonly account: number | null;

  public constructor(account: number | null, reader?: JsonReader) {
    if (!Object.isNull(account))
      FieldCheck.requirePositive(account, Resources.accountField, reader);

    this.account = account;
  }

  public static fromJson(value: unknown, path?: string): RepositoryAccount {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, RepositoryAccount.FIELDS);
    return new RepositoryAccount(reader.readNullableInteger(Resources.accountField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.accountField]: this.account };
  }
}
