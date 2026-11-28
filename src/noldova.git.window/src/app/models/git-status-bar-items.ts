/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { StatusBarItem, TimeFormatService } from "@noldova/desktop.window";

export class GitStatusBarItems {
  public readonly branch: StatusBarItem;
  public readonly fetched: StatusBarItem;
  public readonly command: StatusBarItem;
  public readonly dates: TimeFormatService;

  public constructor(branch: StatusBarItem, fetched: StatusBarItem, command: StatusBarItem, dates: TimeFormatService) {
    this.branch = branch;
    this.fetched = fetched;
    this.command = command;
    this.dates = dates;
  }
}
