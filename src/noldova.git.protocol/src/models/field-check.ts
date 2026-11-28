/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonReader } from "@noldova/context.json";

import { ProtocolFieldException } from "../exceptions/protocol-field.exception.ts";
import { Resources } from "../resources.ts";

export class FieldCheck {
  public static fail(field: string, expectation: string, reader?: JsonReader): never {
    throw new ProtocolFieldException(FieldCheck.pathOf(field, reader), expectation);
  }

  public static refuseUnknownFields(reader: JsonReader, known: readonly string[]): void {
    for (const field of Object.keys(reader.toJson()))
      if (!known.includes(field))
        FieldCheck.fail(field, Resources.unknownField, reader);
  }

  public static readNullableMember<T extends string>(reader: JsonReader, field: string, members: readonly T[]): T | null {
    return Object.isNull(reader.readValue(field)) ? null : reader.readOneOf(field, members);
  }

  public static readNullableModel<T>(reader: JsonReader, field: string, fromJson: (value: unknown, path: string) => T): T | null {
    const child: JsonReader | null = reader.readNullableObject(field);
    return Object.isNull(child) ? null : fromJson(child.toJson(), child.path);
  }

  public static readModel<T>(reader: JsonReader, field: string, fromJson: (value: unknown, path: string) => T): T {
    const child: JsonReader = reader.readObject(field);
    return fromJson(child.toJson(), child.path);
  }

  public static readModels<T>(reader: JsonReader, field: string, fromJson: (value: unknown, path: string) => T): readonly T[] {
    return reader.readObjectArray(field).map(t => fromJson(t.toJson(), t.path));
  }

  public static requireText(value: string, field: string, reader?: JsonReader): void {
    if (value.length === 0)
      FieldCheck.fail(field, Resources.nonEmptyTextExpected, reader);
  }

  public static requireCount(value: number, field: string, reader?: JsonReader): void {
    if (!Number.isSafeInteger(value) || value < 0)
      FieldCheck.fail(field, Resources.countExpected, reader);
  }

  public static requirePositive(value: number | null, field: string, reader?: JsonReader): void {
    if (Object.isNull(value) || !Number.isSafeInteger(value) || value < 1)
      FieldCheck.fail(field, Resources.positiveExpected, reader);
  }

  public static requireObjectId(value: string, field: string, reader?: JsonReader): void {
    if (!Resources.objectIdPattern.test(value))
      FieldCheck.fail(field, Resources.objectIdExpected, reader);
  }

  public static requirePathBytes(value: string | undefined, field: string, reader?: JsonReader): void {
    if (!Object.isUndefined(value) && (value.length === 0 || !Resources.base64Pattern.test(value)))
      FieldCheck.fail(field, Resources.pathBytesExpected, reader);
  }

  public static requireMode(value: string | null, field: string, reader?: JsonReader): void {
    if (!Object.isNull(value) && !Resources.modePattern.test(value))
      FieldCheck.fail(field, Resources.modeExpected, reader);
  }

  public static requireFolder(value: string, field: string, reader?: JsonReader): void {
    if (value.length > Resources.maximumPathLength || !Resources.absolutePathPattern.test(value))
      FieldCheck.fail(field, Resources.folderExpected, reader);
  }

  public static requireRelativePath(value: string, field: string, reader?: JsonReader): void {
    if (value.length === 0
      || value.length > Resources.maximumPathLength
      || Resources.absolutePathPattern.test(value)
      || Resources.refusedPathStartPattern.test(value)
      || value.includes(Resources.nulCharacter)
      || value.split(Resources.pathSeparatorPattern).includes(Resources.parentSegment))
      FieldCheck.fail(field, Resources.relativePathExpected, reader);
  }

  public static requireBranchName(value: string, field: string, reader?: JsonReader): void {
    if (!FieldCheck.isBranchName(value))
      FieldCheck.fail(field, Resources.branchNameExpected, reader);
  }

  public static isBranchName(value: string): boolean {
    return value.length > 0
      && value.length <= Resources.maximumBranchNameLength
      && !value.startsWith(Resources.optionPrefix)
      && value !== Resources.headShorthand
      && value !== Resources.headName
      && !Resources.refusedBranchPattern.test(value)
      && value.split(Resources.branchSegmentSeparator).every(t => t.length > 0 && !t.startsWith(Resources.hiddenPrefix) && !t.endsWith(Resources.lockSuffix));
  }

  public static requireNoNul(value: string, field: string, reader?: JsonReader): void {
    if (value.includes(Resources.nulCharacter))
      FieldCheck.fail(field, Resources.noNulExpected, reader);
  }

  public static requireLine(value: string, field: string, reader?: JsonReader): void {
    if (value.length > Resources.maximumLineLength || Resources.controlCharacterPattern.test(value))
      FieldCheck.fail(field, Resources.lineExpected, reader);
  }

  public static requireNull(value: unknown, field: string, reader?: JsonReader): void {
    if (!Object.isNull(value))
      FieldCheck.fail(field, Resources.nullExpected, reader);
  }

  public static requireAbsent(value: unknown, field: string, reader?: JsonReader): void {
    if (!Object.isUndefined(value))
      FieldCheck.fail(field, Resources.absentExpected, reader);
  }

  private static pathOf(field: string, reader?: JsonReader): string {
    return Object.isUndefined(reader) ? field : Resources.formatFieldPath(reader.path, field);
  }
}
