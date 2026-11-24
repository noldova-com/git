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

/** A person's Abandon: the pull request as the page showed it. */
export class PullRequestAbandonment {
  public readonly reference: HostReference;
  /** The pull request's last merge source commit when the page read it. */
  public readonly sourceCommit: string;

  public constructor(reference: HostReference, sourceCommit: string) {
    this.reference = reference;
    this.sourceCommit = sourceCommit;
  }

  /** The abandonment a window sent, or `null` when it names another organization's pull request or a commit that isn't a whole id. */
  public static fromJson(value: unknown): PullRequestAbandonment | null {
    const reader: JsonReader = JsonReader.fromValue(value);
    const reference: HostReference = HostReference.fromJson(reader.readObject(Resources.referenceField).toJson());
    const sourceCommit: string = reader.readString(Resources.sourceCommitField);
    return Resources.isOwnReference(reference) && Resources.commitIdPattern.test(sourceCommit) ? new PullRequestAbandonment(reference, sourceCommit) : null;
  }
}
