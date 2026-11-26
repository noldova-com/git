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

export class GitConflictParams {
  private static readonly FIELDS: readonly string[] = [Resources.folderField, Resources.pathField];

  public readonly folder: string;
  public readonly path: string;

  public constructor(folder: string, path: string, reader?: JsonReader) {
    FieldCheck.requireFolder(folder, Resources.folderField, reader);
    FieldCheck.requireRelativePath(path, Resources.pathField, reader);

    this.folder = folder;
    this.path = path;
  }

  public static fromJson(value: unknown, path?: string): GitConflictParams {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitConflictParams.FIELDS);
    return new GitConflictParams(reader.readString(Resources.folderField), reader.readString(Resources.pathField), reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.folderField]: this.folder,
      [Resources.pathField]: this.path
    };
  }
}
