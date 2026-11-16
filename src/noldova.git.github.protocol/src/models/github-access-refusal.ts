/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class GitHubAccessRefusal {
  public readonly reason: string;

  public constructor(reason: string) {
    this.reason = reason;
  }
}
