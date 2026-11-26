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

export class GitBranchRenameParams {
  private static readonly FIELDS: readonly string[] = [Resources.folderField, Resources.nameField, Resources.newNameField, Resources.basedOnField];

  public readonly folder: string;
  public readonly name: string;
  public readonly newName: string;
  public readonly basedOn: string;

  public constructor(folder: string, name: string, newName: string, basedOn: string, reader?: JsonReader) {
    FieldCheck.requireFolder(folder, Resources.folderField, reader);
    FieldCheck.requireBranchName(name, Resources.nameField, reader);
    FieldCheck.requireBranchName(newName, Resources.newNameField, reader);
    FieldCheck.requireText(basedOn, Resources.basedOnField, reader);

    this.folder = folder;
    this.name = name;
    this.newName = newName;
    this.basedOn = basedOn;
  }

  public static fromJson(value: unknown, path?: string): GitBranchRenameParams {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitBranchRenameParams.FIELDS);
    return new GitBranchRenameParams(
      reader.readString(Resources.folderField),
      reader.readString(Resources.nameField),
      reader.readString(Resources.newNameField),
      reader.readString(Resources.basedOnField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.folderField]: this.folder,
      [Resources.nameField]: this.name,
      [Resources.newNameField]: this.newName,
      [Resources.basedOnField]: this.basedOn
    };
  }
}
