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

/** A stash: its place in the stash list, 0 for the newest, its message, untrusted, and the full id of its commit. */
export class GitStash {
  private static readonly FIELDS: readonly string[] = [Resources.indexField, Resources.messageField, Resources.idField];

  public readonly index: number;
  public readonly message: string;
  public readonly id: string;

  public constructor(index: number, message: string, id: string, reader?: JsonReader) {
    FieldCheck.requireCount(index, Resources.indexField, reader);
    FieldCheck.requireLine(message, Resources.messageField, reader);
    FieldCheck.requireObjectId(id, Resources.idField, reader);

    this.index = index;
    this.message = message;
    this.id = id;
  }

  public static fromJson(value: unknown, path?: string): GitStash {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitStash.FIELDS);
    return new GitStash(reader.readInteger(Resources.indexField), reader.readString(Resources.messageField), reader.readString(Resources.idField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.indexField]: this.index, [Resources.messageField]: this.message, [Resources.idField]: this.id };
  }
}
