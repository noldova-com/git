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

export class GitCommit {
  private static readonly FIELDS: readonly string[] =
    [Resources.idField, Resources.parentsField, Resources.authorField, Resources.authoredAtField, Resources.subjectField];

  public readonly id: string;
  public readonly parents: readonly string[];
  public readonly author: string;
  public readonly authoredAt: string;
  public readonly subject: string;

  public constructor(id: string, parents: readonly string[], author: string, authoredAt: string, subject: string, reader?: JsonReader) {
    FieldCheck.requireObjectId(id, Resources.idField, reader);
    parents.forEach((parent, index) => FieldCheck.requireObjectId(parent, Resources.formatItemField(Resources.parentsField, index), reader));
    FieldCheck.requireLine(author, Resources.authorField, reader);
    if (!Resources.dateTimePattern.test(authoredAt) || Number.isNaN(Date.parse(authoredAt)))
      FieldCheck.fail(Resources.authoredAtField, Resources.dateTimeExpected, reader);
    FieldCheck.requireLine(subject, Resources.subjectField, reader);

    this.id = id;
    this.parents = parents;
    this.author = author;
    this.authoredAt = authoredAt;
    this.subject = subject;
  }

  public static fromJson(value: unknown, path?: string): GitCommit {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitCommit.FIELDS);
    return new GitCommit(
      reader.readString(Resources.idField),
      reader.readStringArray(Resources.parentsField),
      reader.readString(Resources.authorField),
      reader.readString(Resources.authoredAtField),
      reader.readString(Resources.subjectField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.parentsField]: [...this.parents],
      [Resources.authorField]: this.author,
      [Resources.authoredAtField]: this.authoredAt,
      [Resources.subjectField]: this.subject
    };
  }
}
