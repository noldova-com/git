/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, ErrorHandler, inject, type Signal } from "@angular/core";
import "@noldova/context.core";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import { IconButtonComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources.ts";
import type { GitWorkspaceView } from "../../enums/git-workspace-view.ts";
import type { IGitPullRequests } from "../../interfaces/i-git-pull-requests.ts";
import type { GitWorkspace } from "../../models/git-workspace.ts";
import type { GitWorkspaceSide } from "../../models/git-workspace-side.ts";
import { GitRecentRepositories } from "../../services/git-recent-repositories.ts";
import { GitWorkspacePages } from "../../services/git-workspace-pages.ts";
import { GitWorkspaces } from "../../services/git-workspaces.ts";
import { GitWorkspaceSides } from "../../services/git-workspace-sides.ts";

/**
 * The Workspaces view, in the left dock: the Dashboard and the workspaces, each of which opens its page or brings it to the front, then the views and the
 * hosts of the page in front. One item is chosen at a time, as in a menu: a view while the page shows one, else the page's workspace or the Dashboard.
 */
@Component({
  selector: "nol-git-workspaces",
  imports: [IconButtonComponent],
  templateUrl: "./git-workspaces.component.html",
  styleUrl: "./git-workspaces.component.css"
})
export class GitWorkspacesComponent {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly errors: ErrorHandler = inject(ErrorHandler);

  protected readonly resources: typeof Resources = Resources;
  protected readonly workspaces: Signal<readonly GitWorkspace[]> = GitWorkspaces.list;
  protected readonly recentCount: Signal<number> = computed(() => GitRecentRepositories.recent().length);
  /** The workspace page in front, or the last one while a document of another kind is; null with none open. */
  protected readonly side: Signal<GitWorkspaceSide | null> = GitWorkspaceSides.of(this.context).shown;
  /** The page whose item is chosen: the workspace's id, the Dashboard's null, or undefined while a view is chosen or no page is open. */
  protected readonly chosenPage: Signal<string | null | undefined> = computed(() => {
    const side: GitWorkspaceSide | null = this.side();
    return Object.isNull(side) || !Object.isNull(side.view()) ? undefined : side.workspaceId;
  });

  /**
   * Opens a workspace's page, or the Dashboard's for null, or brings it to the front showing every repository.
   * @param id The workspace's id, or null.
   */
  protected openWorkspace(id: string | null): void {
    const side: GitWorkspaceSide | null = this.side();
    if (!Object.isNull(side) && side.workspaceId === id)
      side.chooseView(null);
    GitWorkspacePages.open(this.context, id);
  }

  protected newWorkspace(): void {
    GitWorkspacePages.open(this.context, GitWorkspaces.create(Resources.newWorkspaceTitle).id);
  }

  /**
   * Shows a view on the page in front; choosing the one it shows keeps it.
   * @param side The page in front.
   * @param view The view.
   */
  protected chooseView(side: GitWorkspaceSide, view: GitWorkspaceView): void {
    if (side.view() !== view)
      side.chooseView(view);
  }

  /** Opens the host's page in Settings, Accounts and hosts, where the person signs in. */
  protected openHost(host: IGitPullRequests): void {
    void this.context.runCommandAsync(Resources.openSettingsCommand, { [Resources.settingsPageArgument]: host.signInPage })
      .catch((error: unknown) => this.errors.handleError(error));
  }
}
