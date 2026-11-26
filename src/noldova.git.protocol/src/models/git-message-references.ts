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
import { GitMessageReference } from "./git-message-reference.ts";

export class GitMessageReferences {
  private static readonly FIELDS: readonly string[] = [Resources.commitsField, Resources.truncatedField];

  public readonly commits: readonly GitMessageReference[];
  public readonly truncated: boolean;

  public constructor(commits: readonly GitMessageReference[], truncated: boolean, reader?: JsonReader) {
    if (commits.length > Resources.maximumGraphLimit)
      FieldCheck.fail(Resources.commitsField, Resources.graphCommitsExpected, reader);

    this.commits = [...commits];
    this.truncated = truncated;
  }

  public static fromJson(value: unknown, path?: string): GitMessageReferences {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitMessageReferences.FIELDS);
    return new GitMessageReferences(FieldCheck.readModels(reader, Resources.commitsField, GitMessageReference.fromJson), reader.readBoolean(Resources.truncatedField),
      reader);
  }

  public toJson(): JsonObject {
    return { [Resources.commitsField]: this.commits.map(t => t.toJson()), [Resources.truncatedField]: this.truncated };
  }
}
