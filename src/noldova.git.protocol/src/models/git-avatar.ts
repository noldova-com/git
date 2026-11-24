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

export class GitAvatar {
  private static readonly FIELDS: readonly string[] = [Resources.imageField];

  public readonly image: string | null;

  public constructor(image: string | null, reader?: JsonReader) {
    if (image !== null && (image.length > Resources.maximumAvatarLength || !Resources.avatarImagePattern.test(image)))
      FieldCheck.fail(Resources.imageField, Resources.avatarImageExpected, reader);

    this.image = image;
  }

  public static fromJson(value: unknown, path?: string): GitAvatar {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitAvatar.FIELDS);
    return new GitAvatar(reader.readNullableString(Resources.imageField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.imageField]: this.image };
  }
}
