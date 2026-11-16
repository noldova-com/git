/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";

import { Resources } from "../resources.ts";
import { DiffScope } from "./diff-scope.ts";
import { FieldCheck } from "./field-check.ts";

export class GitDiffParams {
  private static readonly FIELDS: readonly string[] = [Resources.folderField, Resources.scopeField];

  public readonly folder: string;
  public readonly scope: DiffScope;

  public constructor(folder: string, scope: DiffScope, reader?: JsonReader) {
    FieldCheck.requireFolder(folder, Resources.folderField, reader);

    this.folder = folder;
    this.scope = scope;
  }

  public static fromJson(value: unknown, path?: string): GitDiffParams {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitDiffParams.FIELDS);
    return new GitDiffParams(reader.readString(Resources.folderField), FieldCheck.readModel(reader, Resources.scopeField, DiffScope.fromJson), reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.folderField]: this.folder,
      [Resources.scopeField]: this.scope.toJson()
    };
  }
}
