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

export class GitWorktree {
  private static readonly FIELDS: readonly string[] = [Resources.pathField, Resources.headField, Resources.branchField, Resources.lockedField, Resources.prunableField];

  public readonly path: string;
  public readonly head: string | null;
  public readonly branch: string | null;
  public readonly locked: boolean;
  public readonly prunable: boolean;

  public constructor(path: string, head: string | null, branch: string | null, locked: boolean, prunable: boolean, reader?: JsonReader) {
    FieldCheck.requireFolder(path, Resources.pathField, reader);
    if (head !== null)
      FieldCheck.requireObjectId(head, Resources.headField, reader);
    if (branch !== null)
      FieldCheck.requireBranchName(branch, Resources.branchField, reader);

    this.path = path;
    this.head = head;
    this.branch = branch;
    this.locked = locked;
    this.prunable = prunable;
  }

  public static fromJson(value: unknown, path?: string): GitWorktree {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitWorktree.FIELDS);
    return new GitWorktree(
      reader.readString(Resources.pathField),
      reader.readNullableString(Resources.headField),
      reader.readNullableString(Resources.branchField),
      reader.readBoolean(Resources.lockedField),
      reader.readBoolean(Resources.prunableField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.pathField]: this.path,
      [Resources.headField]: this.head,
      [Resources.branchField]: this.branch,
      [Resources.lockedField]: this.locked,
      [Resources.prunableField]: this.prunable
    };
  }
}
