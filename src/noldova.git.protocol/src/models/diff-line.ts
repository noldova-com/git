/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";

import { LineKind } from "../enums/line-kind.ts";
import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";

export class DiffLine {
  private static readonly FIELDS: readonly string[] = [Resources.kindField, Resources.oldNumberField, Resources.newNumberField, Resources.textField];
  private static readonly WITH_OLD_NUMBER: readonly LineKind[] = [LineKind.Context, LineKind.Removed];
  private static readonly WITH_NEW_NUMBER: readonly LineKind[] = [LineKind.Context, LineKind.Added];

  public readonly kind: LineKind;
  public readonly oldNumber: number | null;
  public readonly newNumber: number | null;
  public readonly text: string;

  public constructor(kind: LineKind, oldNumber: number | null, newNumber: number | null, text: string, reader?: JsonReader) {
    DiffLine.requireNumber(oldNumber, DiffLine.WITH_OLD_NUMBER.includes(kind), Resources.oldNumberField, reader);
    DiffLine.requireNumber(newNumber, DiffLine.WITH_NEW_NUMBER.includes(kind), Resources.newNumberField, reader);

    this.kind = kind;
    this.oldNumber = oldNumber;
    this.newNumber = newNumber;
    this.text = text;
  }

  public static fromJson(value: unknown, path?: string): DiffLine {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, DiffLine.FIELDS);
    return new DiffLine(
      reader.readOneOf(Resources.kindField, Object.values(LineKind)),
      reader.readNullableInteger(Resources.oldNumberField),
      reader.readNullableInteger(Resources.newNumberField),
      reader.readString(Resources.textField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.kindField]: this.kind,
      [Resources.oldNumberField]: this.oldNumber,
      [Resources.newNumberField]: this.newNumber,
      [Resources.textField]: this.text
    };
  }

  private static requireNumber(value: number | null, isNumbered: boolean, field: string, reader?: JsonReader): void {
    if (isNumbered)
      FieldCheck.requirePositive(value, field, reader);
    else
      FieldCheck.requireNull(value, field, reader);
  }
}
