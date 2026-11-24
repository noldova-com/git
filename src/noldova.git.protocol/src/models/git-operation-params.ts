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

export class GitOperationParams {
  private static readonly FIELDS: readonly string[] = [Resources.folderField, Resources.basedOnField];

  public readonly folder: string;
  public readonly basedOn: string;

  public constructor(folder: string, basedOn: string, reader?: JsonReader) {
    FieldCheck.requireFolder(folder, Resources.folderField, reader);
    FieldCheck.requireText(basedOn, Resources.basedOnField, reader);

    this.folder = folder;
    this.basedOn = basedOn;
  }

  public static fromJson(value: unknown, path?: string): GitOperationParams {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitOperationParams.FIELDS);
    return new GitOperationParams(reader.readString(Resources.folderField), reader.readString(Resources.basedOnField), reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.folderField]: this.folder,
      [Resources.basedOnField]: this.basedOn
    };
  }
}
