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

export class HostPerson {
  private static readonly FIELDS: readonly string[] = [Resources.loginField, Resources.avatarField, Resources.urlField];

  public readonly login: string;
  public readonly avatar: string | null;
  public readonly url: string | null;

  public constructor(login: string, avatar: string | null, url: string | null, reader?: JsonReader) {
    FieldCheck.requireText(login, Resources.loginField, reader);
    if (avatar !== null)
      FieldCheck.requireAvatar(avatar, Resources.avatarField, reader);
    if (url !== null)
      FieldCheck.requireHttps(url, Resources.urlField, reader);

    this.login = login;
    this.avatar = avatar;
    this.url = url;
  }

  public static fromJson(value: unknown, path?: string): HostPerson {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostPerson.FIELDS);
    return new HostPerson(reader.readString(Resources.loginField), reader.readNullableString(Resources.avatarField),
      reader.readNullableString(Resources.urlField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.loginField]: this.login, [Resources.avatarField]: this.avatar, [Resources.urlField]: this.url };
  }
}
