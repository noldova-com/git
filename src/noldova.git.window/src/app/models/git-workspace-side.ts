/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Signal } from "@angular/core";

import type { GitWorkspaceView } from "../enums/git-workspace-view.ts";
import type { GitWorkspaceHost } from "./git-workspace-host.ts";
import type { GitWorkspaceViewCount } from "./git-workspace-view-count.ts";

export class GitWorkspaceSide {
  public readonly workspaceId: string | null;
  public readonly view: Signal<GitWorkspaceView | null>;
  public readonly views: Signal<readonly GitWorkspaceViewCount[]>;
  public readonly hosts: Signal<readonly GitWorkspaceHost[]>;
  private readonly choose: (view: GitWorkspaceView | null) => void;

  public constructor(workspaceId: string | null, view: Signal<GitWorkspaceView | null>, views: Signal<readonly GitWorkspaceViewCount[]>,
    hosts: Signal<readonly GitWorkspaceHost[]>, choose: (view: GitWorkspaceView | null) => void) {
    this.workspaceId = workspaceId;
    this.view = view;
    this.views = views;
    this.hosts = hosts;
    this.choose = choose;
  }

  public chooseView(view: GitWorkspaceView | null): void {
    this.choose(view);
  }
}
