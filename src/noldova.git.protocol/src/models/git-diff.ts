/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type JsonObject, JsonReader } from "@noldova/context.json";

import { Resources } from "../resources.ts";
import { DiffFile } from "./diff-file.ts";
import { DiffTotals } from "./diff-totals.ts";
import { FieldCheck } from "./field-check.ts";

export class GitDiff {
  private static readonly FIELDS: readonly string[] = [Resources.filesField, Resources.totalBytesField, Resources.omittedFilesField, Resources.truncatedField,
    Resources.totalsField];

  public readonly files: readonly DiffFile[];
  public readonly totalBytes: number;
  public readonly omittedFiles: number;
  public readonly truncated: boolean;
  public readonly totals: DiffTotals | null;

  public constructor(files: readonly DiffFile[], totalBytes: number, omittedFiles: number, truncated: boolean, totals: DiffTotals | null = null, reader?: JsonReader) {
    FieldCheck.requireCount(totalBytes, Resources.totalBytesField, reader);
    FieldCheck.requireCount(omittedFiles, Resources.omittedFilesField, reader);
    if (omittedFiles > 0 && !truncated)
      FieldCheck.fail(Resources.truncatedField, Resources.truncatedExpected, reader);
    if (!Object.isNull(totals) && !truncated)
      FieldCheck.fail(Resources.totalsField, Resources.totalsExpected, reader);

    this.files = files;
    this.totalBytes = totalBytes;
    this.omittedFiles = omittedFiles;
    this.truncated = truncated;
    this.totals = totals;
  }

  public static fromJson(value: unknown, path?: string): GitDiff {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitDiff.FIELDS);
    return new GitDiff(
      FieldCheck.readModels(reader, Resources.filesField, DiffFile.fromJson),
      reader.readInteger(Resources.totalBytesField),
      reader.readInteger(Resources.omittedFilesField),
      reader.readBoolean(Resources.truncatedField),
      FieldCheck.readNullableModel(reader, Resources.totalsField, DiffTotals.fromJson),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.filesField]: this.files.map(t => t.toJson()),
      [Resources.totalBytesField]: this.totalBytes,
      [Resources.omittedFilesField]: this.omittedFiles,
      [Resources.truncatedField]: this.truncated,
      [Resources.totalsField]: this.totals?.toJson() ?? null
    };
  }
}
