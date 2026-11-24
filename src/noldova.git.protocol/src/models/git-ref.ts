/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";

import { RefKind } from "../enums/ref-kind.ts";
import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";

/** A label on a commit; its name is the short name, such as main, origin/main or v1.2.0, and empty for a detached HEAD. */
export class GitRef {
  private static readonly FIELDS: readonly string[] = [Resources.kindField, Resources.nameField];

  public readonly kind: RefKind;
  public readonly name: string;

  public constructor(kind: RefKind, name: string, reader?: JsonReader) {
    if (!Object.values(RefKind).includes(kind))
      FieldCheck.fail(Resources.kindField, Resources.refKindExpected, reader);
    FieldCheck.requireLine(name, Resources.nameField, reader);
    if (kind !== RefKind.Head && name.length === 0)
      FieldCheck.fail(Resources.nameField, Resources.refNameExpected, reader);

    this.kind = kind;
    this.name = name;
  }

  public static fromJson(value: unknown, path?: string): GitRef {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitRef.FIELDS);
    return new GitRef(reader.readOneOf(Resources.kindField, Object.values(RefKind)), reader.readString(Resources.nameField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.kindField]: this.kind, [Resources.nameField]: this.name };
  }
}
