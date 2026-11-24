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

/**
 * One of the commits a rebase would replay: its full id, its whole message, and for a `fixup!` or `squash!` commit the full id of the earlier
 * commit in the rebase that its subject names, or `null`.
 */
export class GitRebaseCommit {
  private static readonly FIELDS: readonly string[] = [Resources.idField, Resources.messageField, Resources.fixupOfField];

  public readonly id: string;
  public readonly message: string;
  public readonly fixupOf: string | null;

  public constructor(id: string, message: string, fixupOf: string | null, reader?: JsonReader) {
    FieldCheck.requireObjectId(id, Resources.idField, reader);
    FieldCheck.requireNoNul(message, Resources.messageField, reader);
    if (fixupOf !== null)
      FieldCheck.requireObjectId(fixupOf, Resources.fixupOfField, reader);

    this.id = id;
    this.message = message;
    this.fixupOf = fixupOf;
  }

  /** The message's first line. */
  public get subject(): string {
    const end: number = this.message.indexOf(Resources.newline);
    return end < 0 ? this.message : this.message.slice(0, end);
  }

  public static fromJson(value: unknown, path?: string): GitRebaseCommit {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitRebaseCommit.FIELDS);
    return new GitRebaseCommit(reader.readString(Resources.idField), reader.readString(Resources.messageField), reader.readNullableString(Resources.fixupOfField),
      reader);
  }

  public toJson(): JsonObject {
    return { [Resources.idField]: this.id, [Resources.messageField]: this.message, [Resources.fixupOfField]: this.fixupOf };
  }
}
