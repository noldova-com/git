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

export class GitCommand {
  private static readonly FIELDS: readonly string[] = [Resources.idField, Resources.atField, Resources.lineField, Resources.exitCodeField, Resources.millisecondsField];

  public readonly id: string;
  public readonly at: string;
  public readonly line: string;
  public readonly exitCode: number | null;
  public readonly milliseconds: number;

  public constructor(id: string, at: string, line: string, exitCode: number | null, milliseconds: number, reader?: JsonReader) {
    FieldCheck.requireText(id, Resources.idField, reader);
    FieldCheck.requireLine(id, Resources.idField, reader);
    if (!Resources.dateTimePattern.test(at) || Number.isNaN(Date.parse(at)))
      FieldCheck.fail(Resources.atField, Resources.dateTimeExpected, reader);
    FieldCheck.requireText(line, Resources.lineField, reader);
    FieldCheck.requireLine(line, Resources.lineField, reader);
    if (exitCode !== null && !Number.isInteger(exitCode))
      FieldCheck.fail(Resources.exitCodeField, Resources.exitCodeExpected, reader);
    FieldCheck.requireCount(milliseconds, Resources.millisecondsField, reader);

    this.id = id;
    this.at = at;
    this.line = line;
    this.exitCode = exitCode;
    this.milliseconds = milliseconds;
  }

  public static fromJson(value: unknown, path?: string): GitCommand {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitCommand.FIELDS);
    return new GitCommand(reader.readString(Resources.idField), reader.readString(Resources.atField), reader.readString(Resources.lineField),
      reader.readNullableInteger(Resources.exitCodeField), reader.readInteger(Resources.millisecondsField), reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.atField]: this.at,
      [Resources.lineField]: this.line,
      [Resources.exitCodeField]: this.exitCode,
      [Resources.millisecondsField]: this.milliseconds
    };
  }
}
