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
import { GitCommit } from "./git-commit.ts";

export class GitLog {
  private static readonly FIELDS: readonly string[] = [Resources.commitsField, Resources.truncatedField];

  public readonly commits: readonly GitCommit[];
  public readonly truncated: boolean;

  public constructor(commits: readonly GitCommit[], truncated: boolean, reader?: JsonReader) {
    if (commits.length > Resources.maximumLogLimit)
      FieldCheck.fail(Resources.commitsField, Resources.commitsExpected, reader);

    this.commits = commits;
    this.truncated = truncated;
  }

  public static fromJson(value: unknown, path?: string): GitLog {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitLog.FIELDS);
    return new GitLog(FieldCheck.readModels(reader, Resources.commitsField, GitCommit.fromJson), reader.readBoolean(Resources.truncatedField), reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.commitsField]: this.commits.map(t => t.toJson()),
      [Resources.truncatedField]: this.truncated
    };
  }
}
