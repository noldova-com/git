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

/** The answer of `git.mergedBranches`: the remote branch a remote's HEAD names, and the local branches whose tips it holds. */
export class GitMergedBranches {
  private static readonly FIELDS: readonly string[] = [Resources.baseField, Resources.branchesField];

  public readonly base: string | null;
  public readonly branches: readonly string[];

  public constructor(base: string | null, branches: readonly string[], reader?: JsonReader) {
    if (base === null && branches.length > 0)
      FieldCheck.fail(Resources.branchesField, Resources.mergedBaseExpected, reader);
    if (base !== null)
      FieldCheck.requireBranchName(base, Resources.baseField, reader);
    branches.forEach((name, index) => FieldCheck.requireText(name, Resources.formatItemField(Resources.branchesField, index), reader));

    this.base = base;
    this.branches = [...branches];
  }

  public static fromJson(value: unknown, path?: string): GitMergedBranches {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitMergedBranches.FIELDS);
    return new GitMergedBranches(reader.readNullableString(Resources.baseField), reader.readStringArray(Resources.branchesField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.baseField]: this.base, [Resources.branchesField]: [...this.branches] };
  }
}
