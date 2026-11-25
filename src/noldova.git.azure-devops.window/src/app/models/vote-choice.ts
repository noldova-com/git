/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** A vote the pull request's vote menu offers: the value Azure DevOps stores and the words the menu shows. */
export class VoteChoice {
  public readonly vote: number;
  public readonly label: string;

  public constructor(vote: number, label: string) {
    this.vote = vote;
    this.label = label;
  }
}
