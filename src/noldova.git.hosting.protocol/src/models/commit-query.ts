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

export class CommitQuery {
  private static readonly FIELDS: readonly string[] = [Resources.hostField, Resources.pathField, Resources.commitField];

  public readonly host: string;
  public readonly path: string;
  public readonly commit: string;

  public constructor(host: string, path: string, commit: string, reader?: JsonReader) {
    FieldCheck.requireText(host, Resources.hostField, reader);
    FieldCheck.requirePath(path, Resources.pathField, reader);
    FieldCheck.requireCommit(commit, Resources.commitField, reader);

    this.host = host;
    this.path = path;
    this.commit = commit;
  }

  public static fromJson(value: unknown, path?: string): CommitQuery {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, CommitQuery.FIELDS);
    return new CommitQuery(reader.readString(Resources.hostField), reader.readString(Resources.pathField), reader.readString(Resources.commitField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.hostField]: this.host, [Resources.pathField]: this.path, [Resources.commitField]: this.commit };
  }
}
