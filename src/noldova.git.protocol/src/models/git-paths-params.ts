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

export class GitPathsParams {
  private static readonly FIELDS: readonly string[] = [Resources.folderField, Resources.pathsField, Resources.basedOnField];

  public readonly folder: string;
  public readonly paths: readonly string[];
  public readonly basedOn: string;

  public constructor(folder: string, paths: readonly string[], basedOn: string, reader?: JsonReader) {
    FieldCheck.requireFolder(folder, Resources.folderField, reader);
    if (paths.length === 0 || paths.length > Resources.maximumPathCount)
      FieldCheck.fail(Resources.pathsField, Resources.pathCountExpected, reader);
    paths.forEach((path, index) => FieldCheck.requireRelativePath(path, Resources.formatItemField(Resources.pathsField, index), reader));
    FieldCheck.requireText(basedOn, Resources.basedOnField, reader);

    this.folder = folder;
    this.paths = paths;
    this.basedOn = basedOn;
  }

  public static fromJson(value: unknown, path?: string): GitPathsParams {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitPathsParams.FIELDS);
    return new GitPathsParams(
      reader.readString(Resources.folderField),
      reader.readStringArray(Resources.pathsField),
      reader.readString(Resources.basedOnField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.folderField]: this.folder,
      [Resources.pathsField]: [...this.paths],
      [Resources.basedOnField]: this.basedOn
    };
  }
}
