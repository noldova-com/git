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

export class HostComment {
  private static readonly FIELDS: readonly string[] = [Resources.idField, Resources.parentField, Resources.authorField, Resources.publishedAtField,
    Resources.bodyField];

  public readonly id: number;
  public readonly parent: number | null;
  public readonly author: HostPerson;
  public readonly publishedAt: number;
  public readonly body: string;

  public constructor(id: number, parent: number | null, author: HostPerson, publishedAt: number, body: string, reader?: JsonReader) {
    FieldCheck.requirePositive(id, Resources.idField, reader);
    if (!Object.isNull(parent)) {
      FieldCheck.requirePositive(parent, Resources.parentField, reader);
      if (parent === id)
        FieldCheck.fail(Resources.parentField, Resources.commentParentExpected, reader);
    }
    FieldCheck.requirePositive(publishedAt, Resources.publishedAtField, reader);
    FieldCheck.requireText(body, Resources.bodyField, reader);

    this.id = id;
    this.parent = parent;
    this.author = author;
    this.publishedAt = publishedAt;
    this.body = body;
  }

  public static fromJson(value: unknown, path?: string): HostComment {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostComment.FIELDS);
    const author = reader.readObject(Resources.authorField);
    return new HostComment(reader.readInteger(Resources.idField), reader.readNullableInteger(Resources.parentField),
      HostPerson.fromJson(author.toJson(), author.path), reader.readInteger(Resources.publishedAtField), reader.readString(Resources.bodyField), reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.parentField]: this.parent,
      [Resources.authorField]: this.author.toJson(),
      [Resources.publishedAtField]: this.publishedAt,
      [Resources.bodyField]: this.body
    };
  }
}
