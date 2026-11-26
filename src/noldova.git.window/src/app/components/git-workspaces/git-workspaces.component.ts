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
  protected readonly side: Signal<GitWorkspaceSide | null> = GitWorkspaceSides.of(this.context).shown;
  protected readonly chosenPage: Signal<string | null | undefined> = computed(() => {
    const side: GitWorkspaceSide | null = this.side();
    return Object.isNull(side) || !Object.isNull(side.view()) ? undefined : side.workspaceId;
  });

  protected openWorkspace(id: string | null): void {
    const side: GitWorkspaceSide | null = this.side();
    if (!Object.isNull(side) && side.workspaceId === id)
      side.chooseView(null);
    GitWorkspacePages.open(this.context, id);
  }

  protected newWorkspace(): void {
    GitWorkspacePages.open(this.context, GitWorkspaces.create(Resources.newWorkspaceTitle).id);
  }

  protected chooseView(side: GitWorkspaceSide, view: GitWorkspaceView): void {
    if (side.view() !== view)
      side.chooseView(view);
  }

  protected openHost(host: IGitPullRequests): void {
    void this.context.runCommandAsync(Resources.openSettingsCommand, { [Resources.settingsPageArgument]: host.signInPage })
      .catch((error: unknown) => this.errors.handleError(error));
  }
}
