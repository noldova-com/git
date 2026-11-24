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

export class HostAvatar {
  private static readonly FIELDS: readonly string[] = [Resources.avatarField];

  public readonly avatar: string | null;

  public constructor(avatar: string | null, reader?: JsonReader) {
    if (avatar !== null)
      FieldCheck.requireAvatar(avatar, Resources.avatarField, reader);

    this.avatar = avatar;
  }

  public static fromJson(value: unknown, path?: string): HostAvatar {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostAvatar.FIELDS);
    return new HostAvatar(reader.readNullableString(Resources.avatarField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.avatarField]: this.avatar };
  }
}
