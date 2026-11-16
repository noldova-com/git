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

export class GitBranches {
  private static readonly FIELDS: readonly string[] = [Resources.currentField, Resources.branchesField, Resources.remotesField, Resources.remoteBranchesField];

  public readonly current: string | null;
  public readonly branches: readonly string[];
  public readonly remotes: readonly string[];
  public readonly remoteBranches: readonly string[];

  public constructor(current: string | null, branches: readonly string[], remotes: readonly string[], remoteBranches: readonly string[], reader?: JsonReader) {
    if (current !== null)
      FieldCheck.requireText(current, Resources.currentField, reader);
    for (const [names, field] of [[branches, Resources.branchesField], [remotes, Resources.remotesField]] as const)
      names.forEach((name, index) => FieldCheck.requireText(name, Resources.formatItemField(field, index), reader));
    remoteBranches.forEach((name, index) => FieldCheck.requireBranchName(name, Resources.formatItemField(Resources.remoteBranchesField, index), reader));

    this.current = current;
    this.branches = branches;
    this.remotes = remotes;
    this.remoteBranches = remoteBranches;
  }

  public static fromJson(value: unknown, path?: string): GitBranches {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitBranches.FIELDS);
    return new GitBranches(
      reader.readNullableString(Resources.currentField),
      reader.readStringArray(Resources.branchesField),
      reader.readStringArray(Resources.remotesField),
      reader.readStringArray(Resources.remoteBranchesField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.currentField]: this.current,
      [Resources.branchesField]: [...this.branches],
      [Resources.remotesField]: [...this.remotes],
      [Resources.remoteBranchesField]: [...this.remoteBranches]
    };
  }
}
