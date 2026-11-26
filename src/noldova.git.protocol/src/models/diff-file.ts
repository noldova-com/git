/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";

import { FileChange } from "../enums/file-change.ts";
import { Resources } from "../resources.ts";
import { DiffHunk } from "./diff-hunk.ts";
import { FieldCheck } from "./field-check.ts";
import { SubmoduleChange } from "./submodule-change.ts";

export class DiffFile {
  private static readonly FIELDS: readonly string[] = [
    Resources.pathField,
    Resources.pathBytesField,
    Resources.oldPathField,
    Resources.oldPathBytesField,
    Resources.changeField,
    Resources.oldModeField,
    Resources.newModeField,
    Resources.binaryField,
    Resources.submoduleField,
    Resources.hunksField,
    Resources.truncatedField,
    Resources.similarityField
  ];
  private static readonly MOVED: readonly FileChange[] = [FileChange.Renamed, FileChange.Copied];

  public readonly path: string;
  public readonly pathBytes: string | undefined;
  public readonly oldPath: string;
  public readonly oldPathBytes: string | undefined;
  public readonly change: FileChange;
  public readonly oldMode: string | null;
  public readonly newMode: string | null;
  public readonly binary: boolean;
  public readonly submodule: SubmoduleChange | null;
  public readonly hunks: readonly DiffHunk[];
  public readonly truncated: boolean;
  public readonly similarity: number | null;

  public constructor(
    path: string,
    pathBytes: string | undefined,
    oldPath: string,
    oldPathBytes: string | undefined,
    change: FileChange,
    oldMode: string | null,
    newMode: string | null,
    binary: boolean,
    submodule: SubmoduleChange | null,
    hunks: readonly DiffHunk[],
    truncated: boolean,
    similarity: number | null = null,
    reader?: JsonReader) {
    FieldCheck.requireText(path, Resources.pathField, reader);
    FieldCheck.requirePathBytes(pathBytes, Resources.pathBytesField, reader);
    FieldCheck.requireText(oldPath, Resources.oldPathField, reader);
    FieldCheck.requirePathBytes(oldPathBytes, Resources.oldPathBytesField, reader);
    if (!DiffFile.MOVED.includes(change) && (oldPath !== path || oldPathBytes !== pathBytes))
      FieldCheck.fail(Resources.oldPathField, Resources.oldPathExpected, reader);
    FieldCheck.requireMode(oldMode, Resources.oldModeField, reader);
    FieldCheck.requireMode(newMode, Resources.newModeField, reader);
    if (change === FileChange.Added)
      FieldCheck.requireNull(oldMode, Resources.oldModeField, reader);
    if (change === FileChange.Deleted)
      FieldCheck.requireNull(newMode, Resources.newModeField, reader);
    if (binary && hunks.length > 0)
      FieldCheck.fail(Resources.hunksField, Resources.binaryHunksExpected, reader);
    if (similarity !== null && (!DiffFile.MOVED.includes(change) || !Number.isSafeInteger(similarity) || similarity < 0 || similarity > 100))
      FieldCheck.fail(Resources.similarityField, Resources.similarityExpected, reader);

    this.path = path;
    this.pathBytes = pathBytes;
    this.oldPath = oldPath;
    this.oldPathBytes = oldPathBytes;
    this.change = change;
    this.oldMode = oldMode;
    this.newMode = newMode;
    this.binary = binary;
    this.submodule = submodule;
    this.hunks = hunks;
    this.truncated = truncated;
    this.similarity = similarity;
  }

  public static fromJson(value: unknown, path?: string): DiffFile {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, DiffFile.FIELDS);
    return new DiffFile(
      reader.readString(Resources.pathField),
      reader.readOptionalString(Resources.pathBytesField),
      reader.readString(Resources.oldPathField),
      reader.readOptionalString(Resources.oldPathBytesField),
      reader.readOneOf(Resources.changeField, Object.values(FileChange)),
      reader.readNullableString(Resources.oldModeField),
      reader.readNullableString(Resources.newModeField),
      reader.readBoolean(Resources.binaryField),
      FieldCheck.readNullableModel(reader, Resources.submoduleField, SubmoduleChange.fromJson),
      FieldCheck.readModels(reader, Resources.hunksField, DiffHunk.fromJson),
      reader.readBoolean(Resources.truncatedField),
      reader.hasField(Resources.similarityField) ? reader.readInteger(Resources.similarityField) : null,
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.pathField]: this.path,
      ...this.pathBytes === undefined ? {} : { [Resources.pathBytesField]: this.pathBytes },
      [Resources.oldPathField]: this.oldPath,
      ...this.oldPathBytes === undefined ? {} : { [Resources.oldPathBytesField]: this.oldPathBytes },
      [Resources.changeField]: this.change,
      [Resources.oldModeField]: this.oldMode,
      [Resources.newModeField]: this.newMode,
      [Resources.binaryField]: this.binary,
      [Resources.submoduleField]: this.submodule?.toJson() ?? null,
      [Resources.hunksField]: this.hunks.map(t => t.toJson()),
      [Resources.truncatedField]: this.truncated,
      ...this.similarity === null ? {} : { [Resources.similarityField]: this.similarity }
    };
  }
}
