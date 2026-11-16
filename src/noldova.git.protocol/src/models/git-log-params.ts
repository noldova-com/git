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

export class GitLogParams {
  private static readonly FIELDS: readonly string[] = [Resources.folderField, Resources.limitField];

  public readonly folder: string;
  public readonly limit: number;

  public constructor(folder: string, limit: number, reader?: JsonReader) {
    FieldCheck.requireFolder(folder, Resources.folderField, reader);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > Resources.maximumLogLimit)
      FieldCheck.fail(Resources.limitField, Resources.logLimitExpected, reader);

    this.folder = folder;
    this.limit = limit;
  }

  public static fromJson(value: unknown, path?: string): GitLogParams {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitLogParams.FIELDS);
    return new GitLogParams(reader.readString(Resources.folderField), reader.readInteger(Resources.limitField), reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.folderField]: this.folder,
      [Resources.limitField]: this.limit
    };
  }
}
