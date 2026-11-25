/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";

import { GitMessageReferenceKind } from "../enums/git-message-reference-kind.ts";
import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";

/** Asks which of the newest limit commits of a folder's repository, in `git.graph`'s order, name references of a kind in their messages. */
export class GitMessageReferencesParams {
  private static readonly FIELDS: readonly string[] = [Resources.folderField, Resources.kindField, Resources.limitField];

  public readonly folder: string;
  public readonly kind: GitMessageReferenceKind;
  public readonly limit: number;

  public constructor(folder: string, kind: GitMessageReferenceKind, limit: number, reader?: JsonReader) {
    FieldCheck.requireFolder(folder, Resources.folderField, reader);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > Resources.maximumGraphLimit)
      FieldCheck.fail(Resources.limitField, Resources.graphLimitExpected, reader);

    this.folder = folder;
    this.kind = kind;
    this.limit = limit;
  }

  public static fromJson(value: unknown, path?: string): GitMessageReferencesParams {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitMessageReferencesParams.FIELDS);
    return new GitMessageReferencesParams(reader.readString(Resources.folderField), reader.readOneOf(Resources.kindField, Object.values(GitMessageReferenceKind)),
      reader.readInteger(Resources.limitField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.folderField]: this.folder, [Resources.kindField]: this.kind, [Resources.limitField]: this.limit };
  }
}
