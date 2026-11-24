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

export class HostChanges {
  private static readonly FIELDS: readonly string[] = [Resources.additionsField, Resources.deletionsField, Resources.changedFilesField,
    Resources.headBranchField, Resources.baseBranchField, Resources.headCommitField];

  public readonly additions: number | null;
  public readonly deletions: number | null;
  public readonly changedFiles: number | null;
  public readonly headBranch: string;
  public readonly baseBranch: string;
  public readonly headCommit: string;

  public constructor(additions: number | null, deletions: number | null, changedFiles: number | null, headBranch: string, baseBranch: string,
    headCommit: string, reader?: JsonReader) {
    const counts: readonly (readonly [number | null, string])[] = [[additions, Resources.additionsField], [deletions, Resources.deletionsField],
      [changedFiles, Resources.changedFilesField]];
    for (const [count, field] of counts) {
      if (count === null) {
        if (additions !== null || deletions !== null || changedFiles !== null)
          FieldCheck.fail(field, Resources.countsExpected, reader);
      }
      else
        FieldCheck.requireCount(count, field, reader);
    }
    FieldCheck.requireText(headBranch, Resources.headBranchField, reader);
    FieldCheck.requireText(baseBranch, Resources.baseBranchField, reader);
    FieldCheck.requireCommit(headCommit, Resources.headCommitField, reader);

    this.additions = additions;
    this.deletions = deletions;
    this.changedFiles = changedFiles;
    this.headBranch = headBranch;
    this.baseBranch = baseBranch;
    this.headCommit = headCommit;
  }

  public static fromJson(value: unknown, path?: string): HostChanges {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostChanges.FIELDS);
    return new HostChanges(
      reader.readNullableInteger(Resources.additionsField),
      reader.readNullableInteger(Resources.deletionsField),
      reader.readNullableInteger(Resources.changedFilesField),
      reader.readString(Resources.headBranchField),
      reader.readString(Resources.baseBranchField),
      reader.readString(Resources.headCommitField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.additionsField]: this.additions,
      [Resources.deletionsField]: this.deletions,
      [Resources.changedFilesField]: this.changedFiles,
      [Resources.headBranchField]: this.headBranch,
      [Resources.baseBranchField]: this.baseBranch,
      [Resources.headCommitField]: this.headCommit
    };
  }
}
