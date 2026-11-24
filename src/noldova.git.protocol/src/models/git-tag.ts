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

/** A tag: its short name, such as v1.2.0, untrusted, and the full id of the commit it points at. */
export class GitTag {
  private static readonly FIELDS: readonly string[] = [Resources.nameField, Resources.idField];

  public readonly name: string;
  public readonly id: string;

  public constructor(name: string, id: string, reader?: JsonReader) {
    FieldCheck.requireText(name, Resources.nameField, reader);
    FieldCheck.requireLine(name, Resources.nameField, reader);
    FieldCheck.requireObjectId(id, Resources.idField, reader);

    this.name = name;
    this.id = id;
  }

  public static fromJson(value: unknown, path?: string): GitTag {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitTag.FIELDS);
    return new GitTag(reader.readString(Resources.nameField), reader.readString(Resources.idField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.nameField]: this.name, [Resources.idField]: this.id };
  }
}
