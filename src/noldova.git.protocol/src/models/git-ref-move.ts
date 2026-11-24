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

/** A ref a write moved: HEAD when detached, or a full branch or tag name, with its commit before and after, null where it didn't exist. */
export class GitRefMove {
  private static readonly FIELDS: readonly string[] = [Resources.nameField, Resources.beforeField, Resources.afterField];

  public readonly name: string;
  public readonly before: string | null;
  public readonly after: string | null;

  public constructor(name: string, before: string | null, after: string | null, reader?: JsonReader) {
    if (!Resources.fullRefPattern.test(name))
      FieldCheck.fail(Resources.nameField, Resources.fullRefExpected, reader);
    FieldCheck.requireLine(name, Resources.nameField, reader);
    if (before !== null)
      FieldCheck.requireObjectId(before, Resources.beforeField, reader);
    if (after !== null)
      FieldCheck.requireObjectId(after, Resources.afterField, reader);
    if (before === after)
      FieldCheck.fail(Resources.afterField, Resources.refMoveExpected, reader);

    this.name = name;
    this.before = before;
    this.after = after;
  }

  public static fromJson(value: unknown, path?: string): GitRefMove {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitRefMove.FIELDS);
    return new GitRefMove(reader.readString(Resources.nameField), reader.readNullableString(Resources.beforeField), reader.readNullableString(Resources.afterField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.nameField]: this.name, [Resources.beforeField]: this.before, [Resources.afterField]: this.after };
  }
}
