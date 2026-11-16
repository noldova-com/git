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

export class GitFolderParams {
  private static readonly FIELDS: readonly string[] = [Resources.folderField];

  public readonly folder: string;

  public constructor(folder: string, reader?: JsonReader) {
    FieldCheck.requireFolder(folder, Resources.folderField, reader);

    this.folder = folder;
  }

  public static fromJson(value: unknown, path?: string): GitFolderParams {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitFolderParams.FIELDS);
    return new GitFolderParams(reader.readString(Resources.folderField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.folderField]: this.folder };
  }
}
