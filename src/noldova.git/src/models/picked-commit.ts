/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class PickedCommit {
  public readonly isMerge: boolean;
  public readonly subject: string;

  public constructor(isMerge: boolean, subject: string) {
    this.isMerge = isMerge;
    this.subject = subject;
  }
}
