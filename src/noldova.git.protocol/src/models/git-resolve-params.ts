/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";

import { ConflictResolution } from "../enums/conflict-resolution.ts";
import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";

export class GitResolveParams {
  private static readonly FIELDS: readonly string[] = [Resources.folderField, Resources.pathField, Resources.resolutionField, Resources.textField,
    Resources.basedOnField];

  public readonly folder: string;
  public readonly path: string;
  public readonly resolution: ConflictResolution;
  public readonly text: string | null;
  public readonly basedOn: string;

  public constructor(folder: string, path: string, resolution: ConflictResolution, text: string | null, basedOn: string, reader?: JsonReader) {
    FieldCheck.requireFolder(folder, Resources.folderField, reader);
    FieldCheck.requireRelativePath(path, Resources.pathField, reader);
    if ((resolution === ConflictResolution.Text) !== (text !== null))
      FieldCheck.fail(Resources.textField, Resources.resolutionTextExpected, reader);
    FieldCheck.requireText(basedOn, Resources.basedOnField, reader);

    this.folder = folder;
    this.path = path;
    this.resolution = resolution;
    this.text = text;
    this.basedOn = basedOn;
  }

  public static fromJson(value: unknown, path?: string): GitResolveParams {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitResolveParams.FIELDS);
    return new GitResolveParams(
      reader.readString(Resources.folderField),
      reader.readString(Resources.pathField),
      reader.readOneOf(Resources.resolutionField, Object.values(ConflictResolution)),
      reader.readNullableString(Resources.textField),
      reader.readString(Resources.basedOnField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.folderField]: this.folder,
      [Resources.pathField]: this.path,
      [Resources.resolutionField]: this.resolution,
      [Resources.textField]: this.text,
      [Resources.basedOnField]: this.basedOn
    };
  }
}
