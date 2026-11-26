/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class GitTextAround {
  public readonly before: string;
  public readonly linked: string;
  public readonly after: string;

  public constructor(before: string, linked: string, after: string) {
    this.before = before;
    this.linked = linked;
    this.after = after;
  }
}
