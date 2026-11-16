/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class GitHubLookColor {
  public readonly color: string;
  public readonly background: string;

  public constructor(color: string, background: string) {
    this.color = color;
    this.background = background;
  }
}
