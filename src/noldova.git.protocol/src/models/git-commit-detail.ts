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

export class GitCommitDetail {
  private static readonly FIELDS: readonly string[] = [
    Resources.idField, Resources.bodyField, Resources.committerField, Resources.committerEmailField, Resources.committedAtField, Resources.truncatedField
  ];

  public readonly id: string;
  public readonly body: string;
  public readonly committer: string;
  public readonly committerEmail: string;
  public readonly committedAt: string;
  public readonly truncated: boolean;

  public constructor(id: string, body: string, committer: string, committerEmail: string, committedAt: string, truncated: boolean, reader?: JsonReader) {
    FieldCheck.requireObjectId(id, Resources.idField, reader);
    FieldCheck.requireNoNul(body, Resources.bodyField, reader);
    FieldCheck.requireLine(committer, Resources.committerField, reader);
    FieldCheck.requireLine(committerEmail, Resources.committerEmailField, reader);
    FieldCheck.requireText(committedAt, Resources.committedAtField, reader);
    FieldCheck.requireLine(committedAt, Resources.committedAtField, reader);

    this.id = id;
    this.body = body;
    this.committer = committer;
    this.committerEmail = committerEmail;
    this.committedAt = committedAt;
    this.truncated = truncated;
  }

  public static fromJson(value: unknown, path?: string): GitCommitDetail {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitCommitDetail.FIELDS);
    return new GitCommitDetail(
      reader.readString(Resources.idField),
      reader.readString(Resources.bodyField),
      reader.readString(Resources.committerField),
      reader.readString(Resources.committerEmailField),
      reader.readString(Resources.committedAtField),
      reader.readBoolean(Resources.truncatedField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.bodyField]: this.body,
      [Resources.committerField]: this.committer,
      [Resources.committerEmailField]: this.committerEmail,
      [Resources.committedAtField]: this.committedAt,
      [Resources.truncatedField]: this.truncated
    };
  }
}
