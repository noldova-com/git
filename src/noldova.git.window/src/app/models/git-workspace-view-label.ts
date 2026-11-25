/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** How the workspace page's side panel shows a view: its icon and its name. */
export class GitWorkspaceViewLabel {
  public readonly icon: string;
  public readonly name: string;

  public constructor(icon: string, name: string) {
    this.icon = icon;
    this.name = name;
  }
}
