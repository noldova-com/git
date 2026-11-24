/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";

import { CheckState } from "../enums/check-state.ts";
import { PullRequestStatus } from "../enums/pull-request-status.ts";
import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";
import type { HostCheck } from "./host-check.ts";
import { HostReference } from "./host-reference.ts";

export class HostPullRequestRow {
  private static readonly FIELDS: readonly string[] = [Resources.referenceField, Resources.titleField, Resources.urlField, Resources.isDraftField,
    Resources.approvalsField, Resources.passedField, Resources.failingField, Resources.pendingField, Resources.headBranchField, Resources.baseBranchField];

  public readonly reference: HostReference;
  public readonly title: string;
  public readonly url: string;
  public readonly isDraft: boolean;
  public readonly approvals: number;
  public readonly passed: number;
  public readonly failing: number;
  public readonly pending: number;
  /** The branch it merges from, without refs/heads/, such as "feature/sign-in". */
  public readonly headBranch: string;
  /** The branch it merges into, without refs/heads/, such as "main", or null when the host didn't say. */
  public readonly baseBranch: string | null;

  public constructor(reference: HostReference, title: string, url: string, isDraft: boolean, approvals: number, passed: number, failing: number,
    pending: number, headBranch: string, baseBranch: string | null = null, reader?: JsonReader) {
    FieldCheck.requireText(title, Resources.titleField, reader);
    FieldCheck.requireHttps(url, Resources.urlField, reader);
    FieldCheck.requireCount(approvals, Resources.approvalsField, reader);
    FieldCheck.requireCount(passed, Resources.passedField, reader);
    FieldCheck.requireCount(failing, Resources.failingField, reader);
    FieldCheck.requireCount(pending, Resources.pendingField, reader);
    FieldCheck.requireText(headBranch, Resources.headBranchField, reader);
    if (baseBranch !== null)
      FieldCheck.requireText(baseBranch, Resources.baseBranchField, reader);

    this.reference = reference;
    this.title = title;
    this.url = url;
    this.isDraft = isDraft;
    this.approvals = approvals;
    this.passed = passed;
    this.failing = failing;
    this.pending = pending;
    this.headBranch = headBranch;
    this.baseBranch = baseBranch;
  }

  /** The worst of its checks: Failed when any fails, else Pending when any runs or waits, else Succeeded when any passed, else None. */
  public get status(): PullRequestStatus {
    if (this.failing > 0)
      return PullRequestStatus.Failed;
    if (this.pending > 0)
      return PullRequestStatus.Pending;
    return this.passed > 0 ? PullRequestStatus.Succeeded : PullRequestStatus.None;
  }

  public static of(reference: HostReference, title: string, url: string, isDraft: boolean, approvals: number,
    checks: readonly HostCheck[], headBranch: string, baseBranch: string | null = null): HostPullRequestRow {
    const count = (...states: readonly CheckState[]): number => checks.filter(t => states.includes(t.state)).length;
    return new HostPullRequestRow(reference, title, url, isDraft, approvals, count(CheckState.Succeeded), count(CheckState.Failed),
      count(CheckState.Queued, CheckState.Running), headBranch, baseBranch);
  }

  public static fromJson(value: unknown, path?: string): HostPullRequestRow {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostPullRequestRow.FIELDS);
    const reference = reader.readObject(Resources.referenceField);
    return new HostPullRequestRow(
      HostReference.fromJson(reference.toJson(), reference.path),
      reader.readString(Resources.titleField),
      reader.readString(Resources.urlField),
      reader.readBoolean(Resources.isDraftField),
      reader.readInteger(Resources.approvalsField),
      reader.readInteger(Resources.passedField),
      reader.readInteger(Resources.failingField),
      reader.readInteger(Resources.pendingField),
      reader.readString(Resources.headBranchField),
      reader.readNullableString(Resources.baseBranchField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.referenceField]: this.reference.toJson(),
      [Resources.titleField]: this.title,
      [Resources.urlField]: this.url,
      [Resources.isDraftField]: this.isDraft,
      [Resources.approvalsField]: this.approvals,
      [Resources.passedField]: this.passed,
      [Resources.failingField]: this.failing,
      [Resources.pendingField]: this.pending,
      [Resources.headBranchField]: this.headBranch,
      [Resources.baseBranchField]: this.baseBranch
    };
  }
}
