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

export class FolderQuery {
  private static readonly FIELDS: readonly string[] = [Resources.folderField, Resources.remoteField];

  public readonly folder: string;
  public readonly remote: string;

  public constructor(folder: string, remote: string, reader?: JsonReader) {
    FieldCheck.requireText(folder, Resources.folderField, reader);
    FieldCheck.requireText(remote, Resources.remoteField, reader);

    this.folder = folder;
    this.remote = remote;
  }

  public static fromJson(value: unknown, path?: string): FolderQuery {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, FolderQuery.FIELDS);
    return new FolderQuery(reader.readString(Resources.folderField), reader.readString(Resources.remoteField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.folderField]: this.folder, [Resources.remoteField]: this.remote };
  }
}
