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

/** A commit a pull request brings: its id, its message's first line, its author's name and when they wrote it. */
export class HostPullRequestCommit {
  private static readonly FIELDS: readonly string[] = [Resources.idField, Resources.subjectField, Resources.authorField, Resources.authoredAtField];

  public readonly id: string;
  public readonly subject: string;
  public readonly author: string;
  /** When the author wrote it, in milliseconds since the epoch. */
  public readonly authoredAt: number;

  public constructor(id: string, subject: string, author: string, authoredAt: number, reader?: JsonReader) {
    FieldCheck.requireCommit(id, Resources.idField, reader);
    FieldCheck.requireText(author, Resources.authorField, reader);
    FieldCheck.requirePositive(authoredAt, Resources.authoredAtField, reader);

    this.id = id;
    this.subject = subject;
    this.author = author;
    this.authoredAt = authoredAt;
  }

  public static fromJson(value: unknown, path?: string): HostPullRequestCommit {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostPullRequestCommit.FIELDS);
    return new HostPullRequestCommit(reader.readString(Resources.idField), reader.readString(Resources.subjectField), reader.readString(Resources.authorField),
      reader.readInteger(Resources.authoredAtField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.idField]: this.id, [Resources.subjectField]: this.subject, [Resources.authorField]: this.author, [Resources.authoredAtField]: this.authoredAt };
  }
}
