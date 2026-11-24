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

export class GitAvatarParams {
  private static readonly FIELDS: readonly string[] = [Resources.emailField];

  public readonly email: string;

  public constructor(email: string, reader?: JsonReader) {
    FieldCheck.requireText(email, Resources.emailField, reader);
    FieldCheck.requireLine(email, Resources.emailField, reader);

    this.email = email;
  }

  public static fromJson(value: unknown, path?: string): GitAvatarParams {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitAvatarParams.FIELDS);
    return new GitAvatarParams(reader.readString(Resources.emailField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.emailField]: this.email };
  }
}
