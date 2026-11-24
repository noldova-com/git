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
import { GitRebaseCommit } from "./git-rebase-commit.ts";

/**
 * `git.rebasePlan`'s answer: the current branch, or `null` on a detached HEAD; the commit it would go onto and the merge base; how many commits
 * the target has past the base; the commits to replay, oldest first; the other local branches that point at one of them, which `updateRefs` moves
 * too; and whether the branch's upstream already has any of them, so the rebase rewrites pushed history.
 */
export class GitRebasePlan {
  private static readonly FIELDS: readonly string[] = [Resources.branchField, Resources.ontoField, Resources.baseField, Resources.ontoAheadField,
    Resources.commitsField, Resources.stackedField, Resources.pushedField];

  public readonly branch: string | null;
  public readonly onto: string;
  public readonly base: string;
  public readonly ontoAhead: number;
  public readonly commits: readonly GitRebaseCommit[];
  public readonly stacked: readonly string[];
  public readonly pushed: boolean;

  public constructor(branch: string | null, onto: string, base: string, ontoAhead: number, commits: readonly GitRebaseCommit[], stacked: readonly string[],
    pushed: boolean, reader?: JsonReader) {
    if (branch !== null)
      FieldCheck.requireBranchName(branch, Resources.branchField, reader);
    FieldCheck.requireObjectId(onto, Resources.ontoField, reader);
    FieldCheck.requireObjectId(base, Resources.baseField, reader);
    FieldCheck.requireCount(ontoAhead, Resources.ontoAheadField, reader);
    if (commits.length > Resources.maximumRebaseSteps)
      FieldCheck.fail(Resources.commitsField, Resources.rebaseStepsExpected, reader);
    stacked.forEach((name, index) => FieldCheck.requireBranchName(name, Resources.formatItemField(Resources.stackedField, index), reader));

    this.branch = branch;
    this.onto = onto;
    this.base = base;
    this.ontoAhead = ontoAhead;
    this.commits = [...commits];
    this.stacked = [...stacked];
    this.pushed = pushed;
  }

  public static fromJson(value: unknown, path?: string): GitRebasePlan {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitRebasePlan.FIELDS);
    return new GitRebasePlan(
      reader.readNullableString(Resources.branchField),
      reader.readString(Resources.ontoField),
      reader.readString(Resources.baseField),
      reader.readInteger(Resources.ontoAheadField),
      FieldCheck.readModels(reader, Resources.commitsField, GitRebaseCommit.fromJson),
      reader.readStringArray(Resources.stackedField),
      reader.readBoolean(Resources.pushedField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.branchField]: this.branch,
      [Resources.ontoField]: this.onto,
      [Resources.baseField]: this.base,
      [Resources.ontoAheadField]: this.ontoAhead,
      [Resources.commitsField]: this.commits.map(t => t.toJson()),
      [Resources.stackedField]: [...this.stacked],
      [Resources.pushedField]: this.pushed
    };
  }
}
