/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type JsonObject, JsonReader } from "@noldova/context.json";

import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";
import { GitBranchTip } from "./git-branch-tip.ts";
import { GitBranchTrack } from "./git-branch-track.ts";

export class GitBranches {
  private static readonly FIELDS: readonly string[] = [Resources.currentField, Resources.branchesField, Resources.remotesField, Resources.remoteBranchesField, Resources.tracksField,
    Resources.tipsField];

  public readonly current: string | null;
  public readonly branches: readonly string[];
  public readonly remotes: readonly string[];
  public readonly remoteBranches: readonly string[];
  public readonly tracks: readonly GitBranchTrack[];
  public readonly tips: readonly GitBranchTip[];

  public constructor(current: string | null, branches: readonly string[], remotes: readonly string[], remoteBranches: readonly string[],
    tracks: readonly GitBranchTrack[] = [], tips: readonly GitBranchTip[] = [], reader?: JsonReader) {
    if (!Object.isNull(current))
      FieldCheck.requireText(current, Resources.currentField, reader);
    for (const [names, field] of [[branches, Resources.branchesField], [remotes, Resources.remotesField]] as const)
      names.forEach((name, index) => FieldCheck.requireText(name, Resources.formatItemField(field, index), reader));
    remoteBranches.forEach((name, index) => FieldCheck.requireBranchName(name, Resources.formatItemField(Resources.remoteBranchesField, index), reader));
    tracks.forEach((track, index) => {
      if (!branches.includes(track.branch))
        FieldCheck.fail(Resources.formatItemField(Resources.tracksField, index), Resources.trackedBranchExpected, reader);
    });
    tips.forEach((tip, index) => {
      if (!branches.includes(tip.branch) || tips.findIndex(t => t.branch === tip.branch) !== index)
        FieldCheck.fail(Resources.formatItemField(Resources.tipsField, index), Resources.tippedBranchExpected, reader);
    });

    this.current = current;
    this.branches = branches;
    this.remotes = remotes;
    this.remoteBranches = remoteBranches;
    this.tracks = tracks;
    this.tips = tips;
  }

  public static fromJson(value: unknown, path?: string): GitBranches {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitBranches.FIELDS);
    return new GitBranches(
      reader.readNullableString(Resources.currentField),
      reader.readStringArray(Resources.branchesField),
      reader.readStringArray(Resources.remotesField),
      reader.readStringArray(Resources.remoteBranchesField),
      FieldCheck.readModels(reader, Resources.tracksField, GitBranchTrack.fromJson),
      FieldCheck.readModels(reader, Resources.tipsField, GitBranchTip.fromJson),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.currentField]: this.current,
      [Resources.branchesField]: [...this.branches],
      [Resources.remotesField]: [...this.remotes],
      [Resources.remoteBranchesField]: [...this.remoteBranches],
      [Resources.tracksField]: this.tracks.map(t => t.toJson()),
      [Resources.tipsField]: this.tips.map(t => t.toJson())
    };
  }
}
