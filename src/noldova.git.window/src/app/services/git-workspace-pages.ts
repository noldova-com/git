/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { IWindowPartContext } from "@noldova/desktop.window";

import { Resources } from "../../resources.ts";
import type { GitWorkspace } from "../models/git-workspace.ts";
import { GitRecentRepositories } from "./git-recent-repositories.ts";
import { GitWorkspaces } from "./git-workspaces.ts";

/** Opens the workspace page's tabs: one per workspace, and one for the repositories opened lately. */
export class GitWorkspacePages {
  /** Opens a workspace's page, or the open repositories' page for null or a workspace that's gone. */
  public static open(context: IWindowPartContext, id: string | null): void {
    const workspace: GitWorkspace | null = Object.isNull(id) ? null : GitWorkspaces.find(id);
    if (Object.isNull(workspace))
      context.openDocument(Resources.workspaceDocumentName, Resources.openRepositoriesInstance, Resources.dashboardTitle);
    else
      context.openDocument(Resources.workspaceDocumentName, workspace.id, workspace.name);
  }

  /** Opens a repository's history and puts it first among the repositories opened lately. */
  public static openRepository(context: IWindowPartContext, folder: string): void {
    GitRecentRepositories.remember(folder);
    context.openDocument(Resources.historyDocumentName, folder, Resources.formatHistoryTitle(folder));
  }
}
