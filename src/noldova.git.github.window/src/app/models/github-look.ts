/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitHubLookColor } from "./github-look-color.ts";

export class GitHubLook {
  public readonly kindLabel: string;
  public readonly stateLabel: string;
  public readonly icon: string;
  public readonly light: GitHubLookColor;
  public readonly dark: GitHubLookColor;

  public constructor(kindLabel: string, stateLabel: string, icon: string, light: GitHubLookColor, dark: GitHubLookColor) {
    this.kindLabel = kindLabel;
    this.stateLabel = stateLabel;
    this.icon = icon;
    this.light = light;
    this.dark = dark;
  }
}
