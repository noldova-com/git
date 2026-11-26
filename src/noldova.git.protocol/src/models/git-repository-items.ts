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
import { GitStash } from "./git-stash.ts";
import { GitSubmodule } from "./git-submodule.ts";
import { GitTag } from "./git-tag.ts";

export class GitRepositoryItems {
  private static readonly FIELDS: readonly string[] = [Resources.tagsField, Resources.stashesField, Resources.submodulesField, Resources.truncatedField];

  public readonly tags: readonly GitTag[];
  public readonly stashes: readonly GitStash[];
  public readonly submodules: readonly GitSubmodule[];
  public readonly truncated: boolean;

  public constructor(tags: readonly GitTag[], stashes: readonly GitStash[], submodules: readonly GitSubmodule[], truncated: boolean) {
    this.tags = tags;
    this.stashes = stashes;
    this.submodules = submodules;
    this.truncated = truncated;
  }

  public static fromJson(value: unknown, path?: string): GitRepositoryItems {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitRepositoryItems.FIELDS);
    return new GitRepositoryItems(
      FieldCheck.readModels(reader, Resources.tagsField, GitTag.fromJson),
      FieldCheck.readModels(reader, Resources.stashesField, GitStash.fromJson),
      FieldCheck.readModels(reader, Resources.submodulesField, GitSubmodule.fromJson),
      reader.readBoolean(Resources.truncatedField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.tagsField]: this.tags.map(t => t.toJson()),
      [Resources.stashesField]: this.stashes.map(t => t.toJson()),
      [Resources.submodulesField]: this.submodules.map(t => t.toJson()),
      [Resources.truncatedField]: this.truncated
    };
  }
}
