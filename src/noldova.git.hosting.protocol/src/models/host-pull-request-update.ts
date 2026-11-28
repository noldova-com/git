/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type JsonObject, JsonReader } from "@noldova/context.json";

import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";
import { HostPerson } from "./host-person.ts";

export class HostPullRequestUpdate {
  private static readonly FIELDS: readonly string[] = [Resources.numberField, Resources.authorField, Resources.createdAtField, Resources.sourceCommitField,
    Resources.commonCommitField];

  public readonly number: number;
  public readonly author: HostPerson | null;
  public readonly createdAt: number;
  public readonly sourceCommit: string;
  public readonly commonCommit: string | null;

  public constructor(number: number, author: HostPerson | null, createdAt: number, sourceCommit: string, commonCommit: string | null, reader?: JsonReader) {
    FieldCheck.requirePositive(number, Resources.numberField, reader);
    FieldCheck.requirePositive(createdAt, Resources.createdAtField, reader);
    FieldCheck.requireCommit(sourceCommit, Resources.sourceCommitField, reader);
    if (!Object.isNull(commonCommit))
      FieldCheck.requireCommit(commonCommit, Resources.commonCommitField, reader);

    this.number = number;
    this.author = author;
    this.createdAt = createdAt;
    this.sourceCommit = sourceCommit;
    this.commonCommit = commonCommit;
  }

  public static fromJson(value: unknown, path?: string): HostPullRequestUpdate {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostPullRequestUpdate.FIELDS);
    return new HostPullRequestUpdate(reader.readInteger(Resources.numberField), FieldCheck.readNullableModel(reader, Resources.authorField, HostPerson.fromJson),
      reader.readInteger(Resources.createdAtField), reader.readString(Resources.sourceCommitField), reader.readNullableString(Resources.commonCommitField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.numberField]: this.number,
      [Resources.authorField]: this.author?.toJson() ?? null,
      [Resources.createdAtField]: this.createdAt,
      [Resources.sourceCommitField]: this.sourceCommit,
      [Resources.commonCommitField]: this.commonCommit
    };
  }
}
