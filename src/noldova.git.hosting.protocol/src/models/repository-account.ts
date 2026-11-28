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

export class RepositoryAccount {
  private static readonly FIELDS: readonly string[] = [Resources.accountField, Resources.isNamedByRemoteField];

  public readonly account: number | null;
  public readonly isNamedByRemote: boolean;

  public constructor(account: number | null, reader?: JsonReader, isNamedByRemote: boolean = false) {
    if (account !== null)
      FieldCheck.requirePositive(account, Resources.accountField, reader);
    if (account === null && isNamedByRemote)
      FieldCheck.fail(Resources.isNamedByRemoteField, Resources.namedAccountExpected, reader);

    this.account = account;
    this.isNamedByRemote = isNamedByRemote;
  }

  public static fromJson(value: unknown, path?: string): RepositoryAccount {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, RepositoryAccount.FIELDS);
    return new RepositoryAccount(reader.readNullableInteger(Resources.accountField), reader,
      reader.hasField(Resources.isNamedByRemoteField) && reader.readBoolean(Resources.isNamedByRemoteField));
  }

  public toJson(): JsonObject {
    return this.isNamedByRemote ? { [Resources.accountField]: this.account, [Resources.isNamedByRemoteField]: true } : { [Resources.accountField]: this.account };
  }
}
