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
import { GitWorktree } from "./git-worktree.ts";

export class GitWorktrees {
  private static readonly FIELDS: readonly string[] = [Resources.worktreesField];

  public readonly worktrees: readonly GitWorktree[];

  public constructor(worktrees: readonly GitWorktree[]) {
    this.worktrees = worktrees;
  }

  public static fromJson(value: unknown, path?: string): GitWorktrees {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitWorktrees.FIELDS);
    return new GitWorktrees(FieldCheck.readModels(reader, Resources.worktreesField, GitWorktree.fromJson));
  }

  public toJson(): JsonObject {
    return { [Resources.worktreesField]: this.worktrees.map(t => t.toJson()) };
  }
}
