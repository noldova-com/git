/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { StatusBarItem } from "@noldova/desktop.window";

/** The status-bar items the window part registered for the Git panel's repository: its branch, its last fetch and its last command. */
export class GitStatusBarItems {
  public readonly branch: StatusBarItem;
  public readonly fetched: StatusBarItem;
  public readonly command: StatusBarItem;

  public constructor(branch: StatusBarItem, fetched: StatusBarItem, command: StatusBarItem) {
    this.branch = branch;
    this.fetched = fetched;
    this.command = command;
  }
}
