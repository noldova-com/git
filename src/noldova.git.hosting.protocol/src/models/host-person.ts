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

export class HostPerson {
  private static readonly FIELDS: readonly string[] = [Resources.loginField, Resources.avatarField, Resources.urlField, Resources.nameField];

  public readonly login: string;
  public readonly avatar: string | null;
  public readonly url: string | null;
  public readonly name: string | null;

  public constructor(login: string, avatar: string | null, url: string | null, reader?: JsonReader, name: string | null = null) {
    FieldCheck.requireText(login, Resources.loginField, reader);
    if (!Object.isNull(avatar))
      FieldCheck.requireAvatar(avatar, Resources.avatarField, reader);
    if (!Object.isNull(url))
      FieldCheck.requireHttps(url, Resources.urlField, reader);
    if (!Object.isNull(name))
      FieldCheck.requireText(name, Resources.nameField, reader);

    this.login = login;
    this.avatar = avatar;
    this.url = url;
    this.name = name;
  }

  public static fromJson(value: unknown, path?: string): HostPerson {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostPerson.FIELDS);
    return new HostPerson(reader.readString(Resources.loginField), reader.readNullableString(Resources.avatarField),
      reader.readNullableString(Resources.urlField), reader, reader.hasField(Resources.nameField) ? reader.readString(Resources.nameField) : null);
  }

  public toJson(): JsonObject {
    const person: JsonObject = { [Resources.loginField]: this.login, [Resources.avatarField]: this.avatar, [Resources.urlField]: this.url };
    return Object.isNull(this.name) ? person : { ...person, [Resources.nameField]: this.name };
  }
}
