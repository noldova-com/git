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

export class PersonQuery {
  private static readonly FIELDS: readonly string[] = [Resources.hostField, Resources.pathField, Resources.loginField];

  public readonly host: string;
  public readonly path: string;
  public readonly login: string;

  public constructor(host: string, path: string, login: string, reader?: JsonReader) {
    FieldCheck.requireText(host, Resources.hostField, reader);
    FieldCheck.requirePath(path, Resources.pathField, reader);
    FieldCheck.requireText(login, Resources.loginField, reader);

    this.host = host;
    this.path = path;
    this.login = login;
  }

  public static fromJson(value: unknown, path?: string): PersonQuery {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, PersonQuery.FIELDS);
    return new PersonQuery(
      reader.readString(Resources.hostField),
      reader.readString(Resources.pathField),
      reader.readString(Resources.loginField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.hostField]: this.host,
      [Resources.pathField]: this.path,
      [Resources.loginField]: this.login
    };
  }
}
