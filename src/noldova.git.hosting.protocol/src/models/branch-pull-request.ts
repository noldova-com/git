/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type JsonObject, JsonReader } from "@noldova/context.json";

import { CheckState } from "../enums/check-state.ts";
import { ReferenceKind } from "../enums/reference-kind.ts";
import { ReviewDecision } from "../enums/review-decision.ts";
import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";
import { HostCheck } from "./host-check.ts";
import { HostItem } from "./host-item.ts";

export class BranchPullRequest {
  private static readonly FIELDS: readonly string[] = [Resources.pullRequestField, Resources.checksField, Resources.reviewDecisionField, Resources.approvalsField];
  private static readonly DECISIONS: readonly ReviewDecision[] = Object.values(ReviewDecision);
  private static readonly WORST_FIRST: readonly CheckState[] = [CheckState.Failed, CheckState.Running, CheckState.Queued, CheckState.Succeeded,
    CheckState.Neutral];

  public readonly pullRequest: HostItem | null;
  public readonly checks: readonly HostCheck[];
  public readonly reviewDecision: ReviewDecision | null;
  public readonly approvals: number | null;

  public constructor(pullRequest: HostItem | null, checks: readonly HostCheck[],
    reviewDecision: ReviewDecision | null = Object.isNull(pullRequest) ? null : ReviewDecision.Waiting, approvals: number | null = null, reader?: JsonReader) {
    if (!Object.isNull(pullRequest) && pullRequest.kind !== ReferenceKind.PullRequest)
      FieldCheck.fail(Resources.pullRequestField, Resources.pullRequestExpected, reader);
    if (Object.isNull(pullRequest) && checks.length > 0)
      FieldCheck.fail(Resources.checksField, Resources.checksExpected, reader);
    if ((Object.isNull(pullRequest)) !== (Object.isNull(reviewDecision)))
      FieldCheck.fail(Resources.reviewDecisionField, Resources.reviewDecisionExpected, reader);
    if (Object.isNull(pullRequest) && !Object.isNull(approvals))
      FieldCheck.fail(Resources.approvalsField, Resources.approvalsExpected, reader);
    if (!Object.isNull(approvals))
      FieldCheck.requireCount(approvals, Resources.approvalsField, reader);

    this.pullRequest = pullRequest;
    this.checks = [...checks];
    this.reviewDecision = reviewDecision;
    this.approvals = approvals;
  }

  public get checksState(): CheckState | null {
    return BranchPullRequest.WORST_FIRST.find(t => this.checks.some(check => check.state === t)) ?? null;
  }

  public static fromJson(value: unknown, path?: string): BranchPullRequest {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, BranchPullRequest.FIELDS);
    const pullRequest: HostItem | null = FieldCheck.readNullableModel(reader, Resources.pullRequestField, HostItem.fromJson);
    return new BranchPullRequest(
      pullRequest,
      reader.readObjectArray(Resources.checksField).map(t => HostCheck.fromJson(t.toJson(), t.path)),
      reader.hasField(Resources.reviewDecisionField) ? FieldCheck.readNullableMember(reader, Resources.reviewDecisionField, BranchPullRequest.DECISIONS)
        : Object.isNull(pullRequest) ? null : ReviewDecision.Waiting,
      reader.hasField(Resources.approvalsField) ? reader.readNullableInteger(Resources.approvalsField) : null,
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.pullRequestField]: this.pullRequest?.toJson() ?? null,
      [Resources.checksField]: this.checks.map(t => t.toJson()),
      [Resources.reviewDecisionField]: this.reviewDecision,
      [Resources.approvalsField]: this.approvals
    };
  }
}
