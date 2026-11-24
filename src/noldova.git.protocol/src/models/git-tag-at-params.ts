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

/** The parameters of `git.createTag`: the folder, the new tag's name, the commit it points at and the status fingerprint the person saw. */
export class GitTagAtParams {
  private static readonly FIELDS: readonly string[] = [Resources.folderField, Resources.nameField, Resources.idField, Resources.basedOnField];

  public readonly folder: string;
  public readonly name: string;
  public readonly id: string;
  public readonly basedOn: string;

  public constructor(folder: string, name: string, id: string, basedOn: string, reader?: JsonReader) {
    FieldCheck.requireFolder(folder, Resources.folderField, reader);
    FieldCheck.requireBranchName(name, Resources.nameField, reader);
    FieldCheck.requireObjectId(id, Resources.idField, reader);
    FieldCheck.requireText(basedOn, Resources.basedOnField, reader);

    this.folder = folder;
    this.name = name;
    this.id = id;
    this.basedOn = basedOn;
  }

  public static fromJson(value: unknown, path?: string): GitTagAtParams {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitTagAtParams.FIELDS);
    return new GitTagAtParams(
      reader.readString(Resources.folderField),
      reader.readString(Resources.nameField),
      reader.readString(Resources.idField),
      reader.readString(Resources.basedOnField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.folderField]: this.folder,
      [Resources.nameField]: this.name,
      [Resources.idField]: this.id,
      [Resources.basedOnField]: this.basedOn
    };
  }
}
