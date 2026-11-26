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

export class DiffTotals {
  private static readonly FIELDS: readonly string[] = [Resources.filesField, Resources.addedField, Resources.removedField];

  public readonly files: number;
  public readonly added: number;
  public readonly removed: number;

  public constructor(files: number, added: number, removed: number, reader?: JsonReader) {
    FieldCheck.requireCount(files, Resources.filesField, reader);
    FieldCheck.requireCount(added, Resources.addedField, reader);
    FieldCheck.requireCount(removed, Resources.removedField, reader);

    this.files = files;
    this.added = added;
    this.removed = removed;
  }

  public static fromJson(value: unknown, path?: string): DiffTotals {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, DiffTotals.FIELDS);
    return new DiffTotals(reader.readInteger(Resources.filesField), reader.readInteger(Resources.addedField), reader.readInteger(Resources.removedField), reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.filesField]: this.files,
      [Resources.addedField]: this.added,
      [Resources.removedField]: this.removed
    };
  }
}
