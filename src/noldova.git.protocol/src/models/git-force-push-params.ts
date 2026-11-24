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
 * The parameters of `git.forcePush`: the folder, the full id of the commit the person saw on the remote's branch, which the push replaces only
 * while the remote still holds it, and the status fingerprint the person saw.
 */
export class GitForcePushParams {
  private static readonly FIELDS: readonly string[] = [Resources.folderField, Resources.expectedField, Resources.basedOnField];

  public readonly folder: string;
  public readonly expected: string;
  public readonly basedOn: string;

  public constructor(folder: string, expected: string, basedOn: string, reader?: JsonReader) {
    FieldCheck.requireFolder(folder, Resources.folderField, reader);
    FieldCheck.requireObjectId(expected, Resources.expectedField, reader);
    FieldCheck.requireText(basedOn, Resources.basedOnField, reader);

    this.folder = folder;
    this.expected = expected;
    this.basedOn = basedOn;
  }

  public static fromJson(value: unknown, path?: string): GitForcePushParams {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitForcePushParams.FIELDS);
    return new GitForcePushParams(reader.readString(Resources.folderField), reader.readString(Resources.expectedField), reader.readString(Resources.basedOnField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.folderField]: this.folder, [Resources.expectedField]: this.expected, [Resources.basedOnField]: this.basedOn };
  }
}
