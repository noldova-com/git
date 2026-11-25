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

/** What the Workspaces view shows of the workspace page in front: which page it is, its views with their counts, the one chosen, and its hosts. */
export class GitWorkspaceSide {
  /** The workspace the page shows, or null for the Dashboard. */
  public readonly workspaceId: string | null;
  /** The view the page shows, or null while it shows every repository. */
  public readonly view: Signal<GitWorkspaceView | null>;
  /** Each view with how many of the page's repositories it holds. */
  public readonly views: Signal<readonly (readonly [GitWorkspaceView, number])[]>;
  public readonly hosts: Signal<readonly GitWorkspaceHost[]>;
  private readonly choose: (view: GitWorkspaceView | null) => void;

  public constructor(workspaceId: string | null, view: Signal<GitWorkspaceView | null>, views: Signal<readonly (readonly [GitWorkspaceView, number])[]>,
    hosts: Signal<readonly GitWorkspaceHost[]>, choose: (view: GitWorkspaceView | null) => void) {
    this.workspaceId = workspaceId;
    this.view = view;
    this.views = views;
    this.hosts = hosts;
    this.choose = choose;
  }

  /**
   * Shows a view on the page, or every repository for null.
   * @param view The view, or null.
   */
  public chooseView(view: GitWorkspaceView | null): void {
    this.choose(view);
  }
}
