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
    Resources.headBranchField, Resources.baseBranchField, Resources.headCommitField, Resources.isCountedField];

  public readonly additions: number;
  public readonly deletions: number;
  public readonly changedFiles: number;
  public readonly headBranch: string;
  public readonly baseBranch: string;
  public readonly headCommit: string;
  /** Whether the host counts the lines and files; when it doesn't, the three counts are zero and show nothing. */
  public readonly isCounted: boolean;

  public constructor(additions: number, deletions: number, changedFiles: number, headBranch: string, baseBranch: string, headCommit: string,
    reader?: JsonReader, isCounted: boolean = true) {
    FieldCheck.requireCount(additions, Resources.additionsField, reader);
    FieldCheck.requireCount(deletions, Resources.deletionsField, reader);
    FieldCheck.requireCount(changedFiles, Resources.changedFilesField, reader);
    if (!isCounted && additions + deletions + changedFiles > 0)
      FieldCheck.fail(Resources.isCountedField, Resources.countsExpected, reader);
    FieldCheck.requireText(headBranch, Resources.headBranchField, reader);
    FieldCheck.requireText(baseBranch, Resources.baseBranchField, reader);
    FieldCheck.requireCommit(headCommit, Resources.headCommitField, reader);

    this.additions = additions;
    this.deletions = deletions;
    this.changedFiles = changedFiles;
    this.headBranch = headBranch;
    this.baseBranch = baseBranch;
    this.headCommit = headCommit;
    this.isCounted = isCounted;
  }

  /** Changes whose host doesn't count the lines and files. */
  public static uncounted(headBranch: string, baseBranch: string, headCommit: string): HostChanges {
    return new HostChanges(0, 0, 0, headBranch, baseBranch, headCommit, undefined, false);
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
      reader,
      reader.hasField(Resources.isCountedField) ? reader.readBoolean(Resources.isCountedField) : true);
  }

  /** The JSON, with `isCounted` only for changes the host doesn't count, so counted changes write the fields they always have. */
  public toJson(): JsonObject {
    return {
      [Resources.additionsField]: this.additions,
      [Resources.deletionsField]: this.deletions,
      [Resources.changedFilesField]: this.changedFiles,
      [Resources.headBranchField]: this.headBranch,
      [Resources.baseBranchField]: this.baseBranch,
      [Resources.headCommitField]: this.headCommit,
      ...this.isCounted ? {} : { [Resources.isCountedField]: false }
    };
  }
}
