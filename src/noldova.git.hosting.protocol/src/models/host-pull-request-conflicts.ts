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

export class HostPullRequestConflicts {
  public static readonly maximumCount: number = Resources.maximumPullRequestConflicts;

  private static readonly FIELDS: readonly string[] = [Resources.pathsField, Resources.hasMoreField];

  public readonly paths: readonly string[];
  public readonly hasMore: boolean;

  public constructor(paths: readonly string[], hasMore: boolean, reader?: JsonReader) {
    for (const path of paths)
      FieldCheck.requireText(path, Resources.pathsField, reader);
    if (paths.length > Resources.maximumPullRequestConflicts)
      FieldCheck.fail(Resources.pathsField, Resources.pullRequestConflictsExpected, reader);
    if (hasMore && paths.length < Resources.maximumPullRequestConflicts)
      FieldCheck.fail(Resources.hasMoreField, Resources.pullRequestConflictsMoreExpected, reader);

    this.paths = [...paths];
    this.hasMore = hasMore;
  }

  public static fromJson(value: unknown, path?: string): HostPullRequestConflicts {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostPullRequestConflicts.FIELDS);
    return new HostPullRequestConflicts(reader.readStringArray(Resources.pathsField), reader.readBoolean(Resources.hasMoreField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.pathsField]: [...this.paths], [Resources.hasMoreField]: this.hasMore };
  }
}
