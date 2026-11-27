/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class GitEmptyState {
  public readonly icon: string;
  public readonly heading: string;
  public readonly text: string;

  public constructor(icon: string, heading: string, text: string) {
    this.icon = icon;
    this.heading = heading;
    this.text = text;
  }
}
