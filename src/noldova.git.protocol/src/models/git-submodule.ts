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

/** A submodule the index holds: its path from the repository's top, untrusted, and the full id of the commit the index records for it. */
export class GitSubmodule {
  private static readonly FIELDS: readonly string[] = [Resources.pathField, Resources.idField];

  public readonly path: string;
  public readonly id: string;

  public constructor(path: string, id: string, reader?: JsonReader) {
    FieldCheck.requireRelativePath(path, Resources.pathField, reader);
    FieldCheck.requireObjectId(id, Resources.idField, reader);

    this.path = path;
    this.id = id;
  }

  public static fromJson(value: unknown, path?: string): GitSubmodule {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitSubmodule.FIELDS);
    return new GitSubmodule(reader.readString(Resources.pathField), reader.readString(Resources.idField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.pathField]: this.path, [Resources.idField]: this.id };
  }
}
