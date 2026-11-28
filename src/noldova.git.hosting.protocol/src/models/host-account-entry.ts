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
import { HostSignIn } from "./host-sign-in.ts";

export class HostAccountEntry {
  private static readonly FIELDS: readonly string[] = [Resources.idField, Resources.signInField, Resources.hostField];

  public readonly id: number;
  public readonly signIn: HostSignIn;
  public readonly host: string | null;

  public constructor(id: number, signIn: HostSignIn, reader?: JsonReader, host: string | null = null) {
    FieldCheck.requirePositive(id, Resources.idField, reader);
    if (host !== null)
      FieldCheck.requireServer(host, Resources.hostField, reader);

    this.id = id;
    this.signIn = signIn;
    this.host = host;
  }

  public static fromJson(value: unknown, path?: string): HostAccountEntry {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostAccountEntry.FIELDS);
    const signIn = reader.readObject(Resources.signInField);
    return new HostAccountEntry(reader.readInteger(Resources.idField), HostSignIn.fromJson(signIn.toJson(), signIn.path), reader,
      reader.hasField(Resources.hostField) ? reader.readString(Resources.hostField) : null);
  }

  public toJson(): JsonObject {
    const json: JsonObject = { [Resources.idField]: this.id, [Resources.signInField]: this.signIn.toJson() };
    return this.host === null ? json : { ...json, [Resources.hostField]: this.host };
  }
}
