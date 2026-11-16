/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";

import { OperationKind } from "../enums/operation-kind.ts";
import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";

export class GitOperation {
  private static readonly FIELDS: readonly string[] = [Resources.kindField, Resources.fromField, Resources.messageField];

  public readonly kind: OperationKind;
  public readonly from: string | null;
  public readonly message: string | null;

  public constructor(kind: OperationKind, from: string | null, message: string | null, reader?: JsonReader) {
    for (const [value, field] of [[from, Resources.fromField], [message, Resources.messageField]] as const)
      if (value !== null)
        FieldCheck.requireText(value, field, reader);

    this.kind = kind;
    this.from = from;
    this.message = message;
  }

  public static fromJson(value: unknown, path?: string): GitOperation {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitOperation.FIELDS);
    return new GitOperation(
      reader.readOneOf(Resources.kindField, Object.values(OperationKind)),
      reader.readNullableString(Resources.fromField),
      reader.readNullableString(Resources.messageField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.kindField]: this.kind,
      [Resources.fromField]: this.from,
      [Resources.messageField]: this.message
    };
  }
}
