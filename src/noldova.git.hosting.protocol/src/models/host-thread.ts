/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";

import { ThreadStatus } from "../enums/thread-status.ts";
import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";
import { HostComment } from "./host-comment.ts";

export class HostThread {
  private static readonly FIELDS: readonly string[] = [Resources.idField, Resources.stateField, Resources.pathField, Resources.lineField,
    Resources.commentsField];
  private static readonly STATES: readonly ThreadStatus[] = Object.values(ThreadStatus);

  public readonly id: number;
  public readonly state: ThreadStatus;
  public readonly path: string | null;
  public readonly line: number | null;
  public readonly comments: readonly HostComment[];

  public constructor(id: number, state: ThreadStatus, path: string | null, line: number | null, comments: readonly HostComment[], reader?: JsonReader) {
    FieldCheck.requirePositive(id, Resources.idField, reader);
    if (path !== null)
      FieldCheck.requireText(path, Resources.pathField, reader);
    if (line !== null) {
      if (path === null)
        FieldCheck.fail(Resources.lineField, Resources.lineExpected, reader);
      FieldCheck.requirePositive(line, Resources.lineField, reader);
    }
    if (comments.length === 0)
      FieldCheck.fail(Resources.commentsField, Resources.commentsExpected, reader);

    this.id = id;
    this.state = state;
    this.path = path;
    this.line = line;
    this.comments = [...comments];
  }

  public static fromJson(value: unknown, path?: string): HostThread {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostThread.FIELDS);
    return new HostThread(reader.readInteger(Resources.idField), reader.readOneOf(Resources.stateField, HostThread.STATES),
      reader.readNullableString(Resources.pathField), reader.readNullableInteger(Resources.lineField),
      reader.readObjectArray(Resources.commentsField).map(t => HostComment.fromJson(t.toJson(), t.path)), reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.stateField]: this.state,
      [Resources.pathField]: this.path,
      [Resources.lineField]: this.line,
      [Resources.commentsField]: this.comments.map(t => t.toJson())
    };
  }
}
