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

export class GitCommitDetailParams {
  private static readonly FIELDS: readonly string[] = [Resources.folderField, Resources.idField];

  public readonly folder: string;
  public readonly id: string;

  public constructor(folder: string, id: string, reader?: JsonReader) {
    FieldCheck.requireFolder(folder, Resources.folderField, reader);
    FieldCheck.requireObjectId(id, Resources.idField, reader);

    this.folder = folder;
    this.id = id;
  }

  public static fromJson(value: unknown, path?: string): GitCommitDetailParams {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitCommitDetailParams.FIELDS);
    return new GitCommitDetailParams(reader.readString(Resources.folderField), reader.readString(Resources.idField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.folderField]: this.folder, [Resources.idField]: this.id };
  }
}
