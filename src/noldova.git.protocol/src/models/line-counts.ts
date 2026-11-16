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

export class LineCounts {
  private static readonly FIELDS: readonly string[] = [Resources.addedField, Resources.removedField];

  public readonly added: number;
  public readonly removed: number;

  public constructor(added: number, removed: number, reader?: JsonReader) {
    FieldCheck.requireCount(added, Resources.addedField, reader);
    FieldCheck.requireCount(removed, Resources.removedField, reader);

    this.added = added;
    this.removed = removed;
  }

  public static fromJson(value: unknown, path?: string): LineCounts {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, LineCounts.FIELDS);
    return new LineCounts(reader.readInteger(Resources.addedField), reader.readInteger(Resources.removedField), reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.addedField]: this.added,
      [Resources.removedField]: this.removed
    };
  }
}
