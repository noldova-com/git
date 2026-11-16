/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";

import { CheckState } from "../enums/check-state.ts";
import { ReferenceKind } from "../enums/reference-kind.ts";
import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";
import { HostCheck } from "./host-check.ts";
import { HostItem } from "./host-item.ts";

export class BranchPullRequest {
  private static readonly FIELDS: readonly string[] = [Resources.pullRequestField, Resources.checksField];
  private static readonly WORST_FIRST: readonly CheckState[] = [CheckState.Failed, CheckState.Running, CheckState.Queued, CheckState.Succeeded,
    CheckState.Neutral];

  public readonly pullRequest: HostItem | null;
  public readonly checks: readonly HostCheck[];

  public constructor(pullRequest: HostItem | null, checks: readonly HostCheck[], reader?: JsonReader) {
    if (pullRequest !== null && pullRequest.kind !== ReferenceKind.PullRequest)
      FieldCheck.fail(Resources.pullRequestField, Resources.pullRequestExpected, reader);
    if (pullRequest === null && checks.length > 0)
      FieldCheck.fail(Resources.checksField, Resources.checksExpected, reader);

    this.pullRequest = pullRequest;
    this.checks = [...checks];
  }

  public get checksState(): CheckState | null {
    return BranchPullRequest.WORST_FIRST.find(t => this.checks.some(check => check.state === t)) ?? null;
  }

  public static fromJson(value: unknown, path?: string): BranchPullRequest {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, BranchPullRequest.FIELDS);
    return new BranchPullRequest(
      FieldCheck.readNullableModel(reader, Resources.pullRequestField, HostItem.fromJson),
      reader.readObjectArray(Resources.checksField).map(t => HostCheck.fromJson(t.toJson(), t.path)),
      reader);
  }

  public toJson(): JsonObject {
    return { [Resources.pullRequestField]: this.pullRequest?.toJson() ?? null, [Resources.checksField]: this.checks.map(t => t.toJson()) };
  }
}
