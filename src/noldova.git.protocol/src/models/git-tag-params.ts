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

export class GitTagParams {
  private static readonly FIELDS: readonly string[] = [Resources.folderField, Resources.nameField, Resources.basedOnField];

  public readonly folder: string;
  public readonly name: string;
  public readonly basedOn: string;

  public constructor(folder: string, name: string, basedOn: string, reader?: JsonReader) {
    FieldCheck.requireFolder(folder, Resources.folderField, reader);
    FieldCheck.requireBranchName(name, Resources.nameField, reader);
    FieldCheck.requireText(basedOn, Resources.basedOnField, reader);

    this.folder = folder;
    this.name = name;
    this.basedOn = basedOn;
  }

  public static fromJson(value: unknown, path?: string): GitTagParams {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitTagParams.FIELDS);
    return new GitTagParams(
      reader.readString(Resources.folderField),
      reader.readString(Resources.nameField),
      reader.readString(Resources.basedOnField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.folderField]: this.folder,
      [Resources.nameField]: this.name,
      [Resources.basedOnField]: this.basedOn
    };
  }
}
