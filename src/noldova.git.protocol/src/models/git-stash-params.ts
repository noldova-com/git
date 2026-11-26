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

export class GitStashParams {
  private static readonly FIELDS: readonly string[] = [Resources.folderField, Resources.messageField, Resources.includeUntrackedField, Resources.basedOnField];

  public readonly folder: string;
  public readonly message: string | null;
  public readonly includeUntracked: boolean;
  public readonly basedOn: string;

  public constructor(folder: string, message: string | null, includeUntracked: boolean, basedOn: string, reader?: JsonReader) {
    FieldCheck.requireFolder(folder, Resources.folderField, reader);
    if (message !== null) {
      FieldCheck.requireText(message, Resources.messageField, reader);
      FieldCheck.requireLine(message, Resources.messageField, reader);
    }
    FieldCheck.requireText(basedOn, Resources.basedOnField, reader);

    this.folder = folder;
    this.message = message;
    this.includeUntracked = includeUntracked;
    this.basedOn = basedOn;
  }

  public static fromJson(value: unknown, path?: string): GitStashParams {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitStashParams.FIELDS);
    return new GitStashParams(reader.readString(Resources.folderField), reader.readNullableString(Resources.messageField),
      reader.readBoolean(Resources.includeUntrackedField), reader.readString(Resources.basedOnField), reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.folderField]: this.folder,
      [Resources.messageField]: this.message,
      [Resources.includeUntrackedField]: this.includeUntracked,
      [Resources.basedOnField]: this.basedOn
    };
  }
}
