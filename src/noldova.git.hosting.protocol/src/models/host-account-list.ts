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
import { HostAccountEntry } from "./host-account-entry.ts";

export class HostAccountList {
  private static readonly FIELDS: readonly string[] = [Resources.accountsField];

  public readonly accounts: readonly HostAccountEntry[];

  public constructor(accounts: readonly HostAccountEntry[], reader?: JsonReader) {
    if (new Set(accounts.map(t => t.id)).size !== accounts.length)
      FieldCheck.fail(Resources.accountsField, Resources.accountIdsExpected, reader);

    this.accounts = [...accounts];
  }

  public static fromJson(value: unknown, path?: string): HostAccountList {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostAccountList.FIELDS);
    return new HostAccountList(reader.readObjectArray(Resources.accountsField).map(t => HostAccountEntry.fromJson(t.toJson(), t.path)), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.accountsField]: this.accounts.map(t => t.toJson()) };
  }
}
