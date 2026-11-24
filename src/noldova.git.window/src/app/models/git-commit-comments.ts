/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** The review comments on a commit as its detail shows them: how many, whether the host's answer was cut, and the host's page that shows them. */
export class GitCommitComments {
  /** The comments the host counted; the detail shows the row only above 0. */
  public readonly count: number;
  /** Whether a page of the host's answer was full, so there may be more than the count. */
  public readonly isCapped: boolean;
  /** The host's page that shows them, which a click opens in the browser; null when there are none. */
  public readonly url: string | null;

  public constructor(count: number, isCapped: boolean, url: string | null) {
    this.count = count;
    this.isCapped = isCapped;
    this.url = url;
  }
}
