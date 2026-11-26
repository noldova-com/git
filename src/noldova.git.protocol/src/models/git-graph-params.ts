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

export class GitGraphParams {
  private static readonly FIELDS: readonly string[] = [Resources.folderField, Resources.limitField, Resources.skipField];

  public readonly folder: string;
  public readonly limit: number;
  public readonly skip: number;

  public constructor(folder: string, limit: number, skip: number, reader?: JsonReader) {
    FieldCheck.requireFolder(folder, Resources.folderField, reader);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > Resources.maximumGraphLimit)
      FieldCheck.fail(Resources.limitField, Resources.graphLimitExpected, reader);
    if (!Number.isSafeInteger(skip) || skip < 0)
      FieldCheck.fail(Resources.skipField, Resources.skipExpected, reader);

    this.folder = folder;
    this.limit = limit;
    this.skip = skip;
  }

  public static fromJson(value: unknown, path?: string): GitGraphParams {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitGraphParams.FIELDS);
    return new GitGraphParams(reader.readString(Resources.folderField), reader.readInteger(Resources.limitField), reader.readInteger(Resources.skipField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.folderField]: this.folder, [Resources.limitField]: this.limit, [Resources.skipField]: this.skip };
  }
}
