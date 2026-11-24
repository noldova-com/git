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

export class PullRequestVote {
  public readonly reference: HostReference;
  public readonly vote: number;

  public constructor(reference: HostReference, vote: number) {
    this.reference = reference;
    this.vote = vote;
  }

  public static fromJson(value: unknown): PullRequestVote | null {
    const reader: JsonReader = JsonReader.fromValue(value);
    const reference: HostReference = HostReference.fromJson(reader.readObject(Resources.referenceField).toJson());
    const vote: number = reader.readInteger(Resources.voteField);
    return Resources.isOwnReference(reference) && Resources.votes.includes(vote) ? new PullRequestVote(reference, vote) : null;
  }
}
