/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class GitCommitComments {
  public readonly count: number;
  public readonly isCapped: boolean;
  public readonly url: string | null;

  public constructor(count: number, isCapped: boolean, url: string | null) {
    this.count = count;
    this.isCapped = isCapped;
    this.url = url;
  }
}
