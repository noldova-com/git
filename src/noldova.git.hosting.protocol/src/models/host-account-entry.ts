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
  private static readonly FIELDS: readonly string[] = [Resources.idField, Resources.signInField];

  public readonly id: number;
  public readonly signIn: HostSignIn;

  public constructor(id: number, signIn: HostSignIn, reader?: JsonReader) {
    FieldCheck.requirePositive(id, Resources.idField, reader);

    this.id = id;
    this.signIn = signIn;
  }

  public static fromJson(value: unknown, path?: string): HostAccountEntry {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostAccountEntry.FIELDS);
    const signIn = reader.readObject(Resources.signInField);
    return new HostAccountEntry(reader.readInteger(Resources.idField), HostSignIn.fromJson(signIn.toJson(), signIn.path), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.idField]: this.id, [Resources.signInField]: this.signIn.toJson() };
  }
}
