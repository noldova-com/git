/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class GitHistoryAsk {
  public readonly folder: string;
  public readonly commitId: string;

  public constructor(folder: string, commitId: string) {
    this.folder = folder;
    this.commitId = commitId;
  }
}
