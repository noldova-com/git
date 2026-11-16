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

export class HostAccount {
  private static readonly FIELDS: readonly string[] = [Resources.loginField, Resources.nameField, Resources.avatarField, Resources.scopesField];

  public readonly login: string;
  public readonly name: string | null;
  public readonly avatar: string | null;
  public readonly scopes: readonly string[];

  public constructor(login: string, name: string | null, avatar: string | null, scopes: readonly string[], reader?: JsonReader) {
    FieldCheck.requireText(login, Resources.loginField, reader);
    if (name !== null)
      FieldCheck.requireText(name, Resources.nameField, reader);
    if (avatar !== null)
      FieldCheck.requireAvatar(avatar, Resources.avatarField, reader);
    for (const scope of scopes)
      FieldCheck.requireText(scope, Resources.scopesField, reader);

    this.login = login;
    this.name = name;
    this.avatar = avatar;
    this.scopes = [...scopes];
  }

  public static fromJson(value: unknown, path?: string): HostAccount {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostAccount.FIELDS);
    return new HostAccount(
      reader.readString(Resources.loginField),
      reader.readNullableString(Resources.nameField),
      reader.readNullableString(Resources.avatarField),
      reader.readStringArray(Resources.scopesField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.loginField]: this.login,
      [Resources.nameField]: this.name,
      [Resources.avatarField]: this.avatar,
      [Resources.scopesField]: [...this.scopes]
    };
  }
}
