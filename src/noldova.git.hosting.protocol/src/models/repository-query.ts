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

export class RepositoryQuery {
  private static readonly FIELDS: readonly string[] = [Resources.hostField, Resources.pathField];

  public readonly host: string;
  public readonly path: string;

  public constructor(host: string, path: string, reader?: JsonReader) {
    FieldCheck.requireText(host, Resources.hostField, reader);
    FieldCheck.requirePath(path, Resources.pathField, reader);

    this.host = host;
    this.path = path;
  }

  public static fromJson(value: unknown, path?: string): RepositoryQuery {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, RepositoryQuery.FIELDS);
    return new RepositoryQuery(reader.readString(Resources.hostField), reader.readString(Resources.pathField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.hostField]: this.host, [Resources.pathField]: this.path };
  }
}
