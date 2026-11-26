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

export class GitBranchTip {
  private static readonly FIELDS: readonly string[] = [Resources.branchField, Resources.idField, Resources.committedAtField];

  public readonly branch: string;
  public readonly id: string;
  public readonly committedAt: string;

  public constructor(branch: string, id: string, committedAt: string, reader?: JsonReader) {
    FieldCheck.requireText(branch, Resources.branchField, reader);
    FieldCheck.requireObjectId(id, Resources.idField, reader);
    if (!Resources.dateTimePattern.test(committedAt) || Number.isNaN(Date.parse(committedAt)))
      FieldCheck.fail(Resources.committedAtField, Resources.dateTimeExpected, reader);

    this.branch = branch;
    this.id = id;
    this.committedAt = committedAt;
  }

  public static fromJson(value: unknown, path?: string): GitBranchTip {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitBranchTip.FIELDS);
    return new GitBranchTip(reader.readString(Resources.branchField), reader.readString(Resources.idField), reader.readString(Resources.committedAtField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.branchField]: this.branch, [Resources.idField]: this.id, [Resources.committedAtField]: this.committedAt };
  }
}
