/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/context.json";
import { HostReference } from "@noldova/git.hosting.protocol";

import { Resources } from "../resources.ts";

/** A person's Complete merge: the pull request as the page showed it, how to merge it and what to do after. */
export class PullRequestCompletion {
  public readonly reference: HostReference;
  /** The pull request's last merge source commit when the page read it. */
  public readonly sourceCommit: string;
  public readonly targetBranch: string;
  /** One of {@link Resources.mergeTypes}. */
  public readonly mergeType: string;
  /** The merge commit's message, or `null` for {@link Resources.fastForwardMergeType}, which writes none. */
  public readonly message: string | null;
  public readonly completeWorkItems: boolean;
  public readonly deleteSourceBranch: boolean;

  public constructor(reference: HostReference, sourceCommit: string, targetBranch: string, mergeType: string, message: string | null, completeWorkItems: boolean,
    deleteSourceBranch: boolean) {
    this.reference = reference;
    this.sourceCommit = sourceCommit;
    this.targetBranch = targetBranch;
    this.mergeType = mergeType;
    this.message = message;
    this.completeWorkItems = completeWorkItems;
    this.deleteSourceBranch = deleteSourceBranch;
  }

  /** The completion a window sent, or `null` when it names another organization's pull request or a value out of range. */
  public static fromJson(value: unknown): PullRequestCompletion | null {
    const reader: JsonReader = JsonReader.fromValue(value);
    const reference: HostReference = HostReference.fromJson(reader.readObject(Resources.referenceField).toJson());
    const sourceCommit: string = reader.readString(Resources.sourceCommitField);
    const targetBranch: string = reader.readString(Resources.targetBranchField);
    const mergeType: string = reader.readString(Resources.mergeTypeField);
    const message: string | null = reader.readNullableString(Resources.messageField);
    const completeWorkItems: boolean = reader.readBoolean(Resources.completeWorkItemsField);
    const deleteSourceBranch: boolean = reader.readBoolean(Resources.deleteSourceBranchField);
    const isFastForward: boolean = mergeType === Resources.fastForwardMergeType;
    const isValid: boolean = Resources.isOwnReference(reference) && Resources.commitIdPattern.test(sourceCommit) && targetBranch.trim().length > 0
      && Resources.mergeTypes.includes(mergeType) && (message === null) === isFastForward
      && (message === null || (message.trim().length > 0 && message.length <= Resources.maximumMergeMessageLength));
    return isValid ? new PullRequestCompletion(reference, sourceCommit, targetBranch, mergeType, message, completeWorkItems, deleteSourceBranch) : null;
  }
}
