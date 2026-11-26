/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitWorkspaceView } from "../enums/git-workspace-view.ts";

export class GitWorkspaceViewCount {
  public readonly view: GitWorkspaceView;
  public readonly count: number;

  public constructor(view: GitWorkspaceView, count: number) {
    this.view = view;
    this.count = count;
  }
}
