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
import { HostPullRequestFile } from "./host-pull-request-file.ts";

/**
 * The files a pull request changes at its latest push, at most 1000, and whether the host has more; with that push's head commit and the commit its changes
 * count from, so a repository that has both can show the changes itself. A pull request the host doesn't show has neither commit and no files.
 */
export class HostPullRequestFiles {
  public static readonly maximumCount: number = Resources.maximumPullRequestFiles;

  private static readonly FIELDS: readonly string[] = [Resources.sourceCommitField, Resources.commonCommitField, Resources.filesField, Resources.hasMoreField];

  public readonly sourceCommit: string | null;
  public readonly commonCommit: string | null;
  public readonly files: readonly HostPullRequestFile[];
  public readonly hasMore: boolean;

  public constructor(sourceCommit: string | null, commonCommit: string | null, files: readonly HostPullRequestFile[], hasMore: boolean, reader?: JsonReader) {
    if (sourceCommit !== null)
      FieldCheck.requireCommit(sourceCommit, Resources.sourceCommitField, reader);
    if (commonCommit !== null)
      FieldCheck.requireCommit(commonCommit, Resources.commonCommitField, reader);
    if (sourceCommit === null && (commonCommit !== null || files.length > 0 || hasMore))
      FieldCheck.fail(Resources.sourceCommitField, Resources.pullRequestFilesCommitExpected, reader);
    if (files.length > Resources.maximumPullRequestFiles)
      FieldCheck.fail(Resources.filesField, Resources.pullRequestFilesExpected, reader);

    this.sourceCommit = sourceCommit;
    this.commonCommit = commonCommit;
    this.files = [...files];
    this.hasMore = hasMore;
  }

  public static fromJson(value: unknown, path?: string): HostPullRequestFiles {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostPullRequestFiles.FIELDS);
    return new HostPullRequestFiles(reader.readNullableString(Resources.sourceCommitField), reader.readNullableString(Resources.commonCommitField),
      reader.readObjectArray(Resources.filesField).map(t => HostPullRequestFile.fromJson(t.toJson(), t.path)), reader.readBoolean(Resources.hasMoreField), reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.sourceCommitField]: this.sourceCommit,
      [Resources.commonCommitField]: this.commonCommit,
      [Resources.filesField]: this.files.map(t => t.toJson()),
      [Resources.hasMoreField]: this.hasMore
    };
  }
}
