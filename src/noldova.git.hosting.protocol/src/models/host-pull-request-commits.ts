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
import { HostPullRequestCommit } from "./host-pull-request-commit.ts";

/** The commits a pull request brings, the newest first, and whether the host has more than the list holds. */
export class HostPullRequestCommits {
  public static readonly maximumCount: number = Resources.maximumPullRequestCommits;

  private static readonly FIELDS: readonly string[] = [Resources.commitsField, Resources.hasMoreField];

  public readonly commits: readonly HostPullRequestCommit[];
  public readonly hasMore: boolean;

  public constructor(commits: readonly HostPullRequestCommit[], hasMore: boolean, reader?: JsonReader) {
    if (commits.length > Resources.maximumPullRequestCommits)
      FieldCheck.fail(Resources.commitsField, Resources.pullRequestCommitsExpected, reader);
    if (hasMore && commits.length < Resources.maximumPullRequestCommits)
      FieldCheck.fail(Resources.hasMoreField, Resources.pullRequestCommitsMoreExpected, reader);

    this.commits = [...commits];
    this.hasMore = hasMore;
  }

  public static fromJson(value: unknown, path?: string): HostPullRequestCommits {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostPullRequestCommits.FIELDS);
    return new HostPullRequestCommits(reader.readObjectArray(Resources.commitsField).map(t => HostPullRequestCommit.fromJson(t.toJson(), t.path)),
      reader.readBoolean(Resources.hasMoreField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.commitsField]: this.commits.map(t => t.toJson()), [Resources.hasMoreField]: this.hasMore };
  }
}
