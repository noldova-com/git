/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";

import { Resources } from "../resources.ts";
import { DiffLine } from "./diff-line.ts";
import { FieldCheck } from "./field-check.ts";

export class DiffHunk {
  private static readonly FIELDS: readonly string[] = [
    Resources.oldStartField,
    Resources.oldCountField,
    Resources.newStartField,
    Resources.newCountField,
    Resources.headerField,
    Resources.linesField
  ];

  public readonly oldStart: number;
  public readonly oldCount: number;
  public readonly newStart: number;
  public readonly newCount: number;
  public readonly header: string;
  public readonly lines: readonly DiffLine[];

  public constructor(oldStart: number, oldCount: number, newStart: number, newCount: number, header: string, lines: readonly DiffLine[], reader?: JsonReader) {
    FieldCheck.requireCount(oldStart, Resources.oldStartField, reader);
    FieldCheck.requireCount(oldCount, Resources.oldCountField, reader);
    FieldCheck.requireCount(newStart, Resources.newStartField, reader);
    FieldCheck.requireCount(newCount, Resources.newCountField, reader);

    this.oldStart = oldStart;
    this.oldCount = oldCount;
    this.newStart = newStart;
    this.newCount = newCount;
    this.header = header;
    this.lines = lines;
  }

  public static fromJson(value: unknown, path?: string): DiffHunk {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, DiffHunk.FIELDS);
    return new DiffHunk(
      reader.readInteger(Resources.oldStartField),
      reader.readInteger(Resources.oldCountField),
      reader.readInteger(Resources.newStartField),
      reader.readInteger(Resources.newCountField),
      reader.readString(Resources.headerField),
      FieldCheck.readModels(reader, Resources.linesField, DiffLine.fromJson),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.oldStartField]: this.oldStart,
      [Resources.oldCountField]: this.oldCount,
      [Resources.newStartField]: this.newStart,
      [Resources.newCountField]: this.newCount,
      [Resources.headerField]: this.header,
      [Resources.linesField]: this.lines.map(t => t.toJson())
    };
  }
}
