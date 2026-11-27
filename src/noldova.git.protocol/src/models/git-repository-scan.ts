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

export class GitRepositoryScan {
  private static readonly FIELDS: readonly string[] = [Resources.inRepositoryField, Resources.repositoriesField];

  public readonly inRepository: boolean;
  public readonly repositories: readonly string[];

  public constructor(inRepository: boolean, repositories: readonly string[], reader?: JsonReader) {
    if (repositories.length > Resources.maximumScanRepositories)
      FieldCheck.fail(Resources.repositoriesField, Resources.scanRepositoriesExpected, reader);
    repositories.forEach((folder, index) => FieldCheck.requireFolder(folder, Resources.formatItemField(Resources.repositoriesField, index), reader));

    this.inRepository = inRepository;
    this.repositories = repositories;
  }

  public static fromJson(value: unknown, path?: string): GitRepositoryScan {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitRepositoryScan.FIELDS);
    return new GitRepositoryScan(reader.readBoolean(Resources.inRepositoryField), reader.readStringArray(Resources.repositoriesField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.inRepositoryField]: this.inRepository, [Resources.repositoriesField]: [...this.repositories] };
  }
}
