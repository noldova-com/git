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

/**
 * The parameters of `git.stageLines` and `git.unstageLines`: the folder, one file, the lines chosen by their place in that file's diff,
 * counting every hunk's lines in order from 0, and the status fingerprint the person saw.
 */
export class GitLinesParams {
  private static readonly FIELDS: readonly string[] = [Resources.folderField, Resources.pathField, Resources.linesField, Resources.basedOnField];

  public readonly folder: string;
  public readonly path: string;
  public readonly lines: readonly number[];
  public readonly basedOn: string;

  public constructor(folder: string, path: string, lines: readonly number[], basedOn: string, reader?: JsonReader) {
    FieldCheck.requireFolder(folder, Resources.folderField, reader);
    FieldCheck.requireRelativePath(path, Resources.pathField, reader);
    if (lines.length === 0 || lines.length > Resources.maximumLineCount || new Set(lines).size !== lines.length)
      FieldCheck.fail(Resources.linesField, Resources.lineCountExpected, reader);
    lines.forEach((line, index) => FieldCheck.requireCount(line, Resources.formatItemField(Resources.linesField, index), reader));
    FieldCheck.requireText(basedOn, Resources.basedOnField, reader);

    this.folder = folder;
    this.path = path;
    this.lines = lines;
    this.basedOn = basedOn;
  }

  public static fromJson(value: unknown, path?: string): GitLinesParams {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitLinesParams.FIELDS);
    return new GitLinesParams(
      reader.readString(Resources.folderField),
      reader.readString(Resources.pathField),
      reader.readNumberArray(Resources.linesField),
      reader.readString(Resources.basedOnField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.folderField]: this.folder,
      [Resources.pathField]: this.path,
      [Resources.linesField]: [...this.lines],
      [Resources.basedOnField]: this.basedOn
    };
  }
}
