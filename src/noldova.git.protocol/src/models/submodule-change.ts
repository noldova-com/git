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

export class SubmoduleChange {
  private static readonly FIELDS: readonly string[] = [Resources.oldCommitField, Resources.newCommitField];

  public readonly oldCommit: string | null;
  public readonly newCommit: string | null;

  public constructor(oldCommit: string | null, newCommit: string | null, reader?: JsonReader) {
    if (oldCommit === null && newCommit === null)
      FieldCheck.fail(Resources.oldCommitField, Resources.submoduleCommitsExpected, reader);
    if (oldCommit !== null)
      FieldCheck.requireObjectId(oldCommit, Resources.oldCommitField, reader);
    if (newCommit !== null)
      FieldCheck.requireObjectId(newCommit, Resources.newCommitField, reader);

    this.oldCommit = oldCommit;
    this.newCommit = newCommit;
  }

  public static fromJson(value: unknown, path?: string): SubmoduleChange {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, SubmoduleChange.FIELDS);
    return new SubmoduleChange(
      reader.readNullableString(Resources.oldCommitField),
      reader.readNullableString(Resources.newCommitField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.oldCommitField]: this.oldCommit,
      [Resources.newCommitField]: this.newCommit
    };
  }
}
