/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";

import { Resources } from "../resources.ts";

export class KeptAccount {
  public readonly id: number;
  public readonly host: string;
  public readonly login: string | null;

  public constructor(id: number, host: string, login: string | null) {
    this.id = id;
    this.host = host;
    this.login = login;
  }

  public static fromJson(value: unknown): KeptAccount {
    const reader: JsonReader = JsonReader.fromValue(value);
    return new KeptAccount(reader.readInteger(Resources.idField), reader.readNonBlankString(Resources.hostField), reader.readNullableString(Resources.loginField));
  }

  public toJson(): JsonObject {
    return { [Resources.idField]: this.id, [Resources.hostField]: this.host, [Resources.loginField]: this.login };
  }
}
