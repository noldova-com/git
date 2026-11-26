/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitHistoryAction } from "../enums/git-history-action.ts";

export class GitHistoryToolbar {
  public readonly title: string;
  public readonly actions: readonly GitHistoryAction[];

  public constructor(title: string, actions: readonly GitHistoryAction[]) {
    this.title = title;
    this.actions = actions;
  }
}
