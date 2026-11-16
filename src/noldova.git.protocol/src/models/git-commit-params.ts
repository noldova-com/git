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

export class GitCommitParams {
  private static readonly FIELDS: readonly string[] = [Resources.folderField, Resources.messageField, Resources.basedOnField];

  public readonly folder: string;
  public readonly message: string;
  public readonly basedOn: string;

  public constructor(folder: string, message: string, basedOn: string, reader?: JsonReader) {
    FieldCheck.requireFolder(folder, Resources.folderField, reader);
    FieldCheck.requireText(message, Resources.messageField, reader);
    FieldCheck.requireNoNul(message, Resources.messageField, reader);
    FieldCheck.requireText(basedOn, Resources.basedOnField, reader);

    this.folder = folder;
    this.message = message;
    this.basedOn = basedOn;
  }

  public static fromJson(value: unknown, path?: string): GitCommitParams {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitCommitParams.FIELDS);
    return new GitCommitParams(
      reader.readString(Resources.folderField),
      reader.readString(Resources.messageField),
      reader.readString(Resources.basedOnField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.folderField]: this.folder,
      [Resources.messageField]: this.message,
      [Resources.basedOnField]: this.basedOn
    };
  }
}
