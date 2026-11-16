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

  public readonly additions: number;
  public readonly deletions: number;
  public readonly changedFiles: number;
  public readonly headBranch: string;
  public readonly baseBranch: string;
  public readonly headCommit: string;

  public constructor(additions: number, deletions: number, changedFiles: number, headBranch: string, baseBranch: string, headCommit: string,
    reader?: JsonReader) {
    FieldCheck.requireCount(additions, Resources.additionsField, reader);
    FieldCheck.requireCount(deletions, Resources.deletionsField, reader);
    FieldCheck.requireCount(changedFiles, Resources.changedFilesField, reader);
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
      reader.readInteger(Resources.additionsField),
      reader.readInteger(Resources.deletionsField),
      reader.readInteger(Resources.changedFilesField),
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
