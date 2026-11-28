/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type JsonObject, JsonReader } from "@noldova/context.json";

import { ReferenceKind } from "../enums/reference-kind.ts";
import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";
import { HostBuild } from "./host-build.ts";
import { HostItem } from "./host-item.ts";
import { HostPolicy } from "./host-policy.ts";
import { HostReviewer } from "./host-reviewer.ts";
import { HostWorkItemLink } from "./host-work-item-link.ts";

export class HostPullRequest {
  private static readonly FIELDS: readonly string[] = [Resources.itemField, Resources.reviewersField, Resources.policiesField, Resources.buildsField,
    Resources.isAutoCompleteField, Resources.descriptionField, Resources.commitCountField, Resources.workItemsField, Resources.autoCompleteMergeTypeField,
    Resources.hasConflictsField];

  public readonly item: HostItem;
  public readonly reviewers: readonly HostReviewer[];
  public readonly policies: readonly HostPolicy[];
  public readonly builds: readonly HostBuild[];
  public readonly isAutoComplete: boolean;
  public readonly description: string;
  public readonly commitCount: number | null;
  public readonly workItems: readonly HostWorkItemLink[];
  public readonly autoCompleteMergeType: string | null;
  public readonly hasConflicts: boolean | null;

  public constructor(item: HostItem, reviewers: readonly HostReviewer[], policies: readonly HostPolicy[], builds: readonly HostBuild[],
    isAutoComplete: boolean, description: string, commitCount: number | null, workItems: readonly HostWorkItemLink[], autoCompleteMergeType: string | null = null,
    hasConflicts: boolean | null = null, reader?: JsonReader) {
    if (item.kind !== ReferenceKind.PullRequest)
      FieldCheck.fail(Resources.itemField, Resources.pullRequestExpected, reader);
    if (!Object.isNull(commitCount))
      FieldCheck.requireCount(commitCount, Resources.commitCountField, reader);
    if (!Object.isNull(autoCompleteMergeType))
      FieldCheck.requireText(autoCompleteMergeType, Resources.autoCompleteMergeTypeField, reader);

    this.item = item;
    this.reviewers = [...reviewers];
    this.policies = [...policies];
    this.builds = [...builds];
    this.isAutoComplete = isAutoComplete;
    this.description = description;
    this.commitCount = commitCount;
    this.workItems = [...workItems];
    this.autoCompleteMergeType = autoCompleteMergeType;
    this.hasConflicts = hasConflicts;
  }

  public static fromJson(value: unknown, path?: string): HostPullRequest {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostPullRequest.FIELDS);
    const item = reader.readObject(Resources.itemField);
    return new HostPullRequest(
      HostItem.fromJson(item.toJson(), item.path),
      reader.readObjectArray(Resources.reviewersField).map(t => HostReviewer.fromJson(t.toJson(), t.path)),
      reader.readObjectArray(Resources.policiesField).map(t => HostPolicy.fromJson(t.toJson(), t.path)),
      reader.readObjectArray(Resources.buildsField).map(t => HostBuild.fromJson(t.toJson(), t.path)),
      reader.readBoolean(Resources.isAutoCompleteField),
      reader.readString(Resources.descriptionField),
      reader.readNullableInteger(Resources.commitCountField),
      reader.readObjectArray(Resources.workItemsField).map(t => HostWorkItemLink.fromJson(t.toJson(), t.path)),
      reader.readNullableString(Resources.autoCompleteMergeTypeField),
      Object.isNull(reader.readValue(Resources.hasConflictsField)) ? null : reader.readBoolean(Resources.hasConflictsField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.itemField]: this.item.toJson(),
      [Resources.reviewersField]: this.reviewers.map(t => t.toJson()),
      [Resources.policiesField]: this.policies.map(t => t.toJson()),
      [Resources.buildsField]: this.builds.map(t => t.toJson()),
      [Resources.isAutoCompleteField]: this.isAutoComplete,
      [Resources.descriptionField]: this.description,
      [Resources.commitCountField]: this.commitCount,
      [Resources.workItemsField]: this.workItems.map(t => t.toJson()),
      [Resources.autoCompleteMergeTypeField]: this.autoCompleteMergeType,
      [Resources.hasConflictsField]: this.hasConflicts
    };
  }
}
