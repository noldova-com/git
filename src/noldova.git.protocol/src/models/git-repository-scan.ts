/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";

import { ScanEnd } from "../enums/scan-end.ts";
import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";

export class GitRepositoryScan {
  private static readonly FIELDS: readonly string[] = [Resources.endField, Resources.repositoriesField];

  public readonly end: ScanEnd;
  public readonly repositories: readonly string[];

  public constructor(end: ScanEnd, repositories: readonly string[], reader?: JsonReader) {
    if (repositories.length > Resources.maximumScanRepositories)
      FieldCheck.fail(Resources.repositoriesField, Resources.scanRepositoriesExpected, reader);
    if (repositories.length > 0 && (end === ScanEnd.Repository || end === ScanEnd.Unreadable))
      FieldCheck.fail(Resources.repositoriesField, Resources.scanEndRepositoriesExpected, reader);
    repositories.forEach((folder, index) => FieldCheck.requireFolder(folder, Resources.formatItemField(Resources.repositoriesField, index), reader));

    this.end = end;
    this.repositories = repositories;
  }

  public static fromJson(value: unknown, path?: string): GitRepositoryScan {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitRepositoryScan.FIELDS);
    return new GitRepositoryScan(reader.readOneOf(Resources.endField, Object.values(ScanEnd)), reader.readStringArray(Resources.repositoriesField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.endField]: this.end, [Resources.repositoriesField]: [...this.repositories] };
  }
}
