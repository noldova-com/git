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
import { GitWorkspaces } from "./git-workspaces.ts";

export class GitWorkspacePages {
  public static open(context: IWindowPartContext, id: string | null): void {
    const workspace: GitWorkspace | null = Object.isNull(id) ? null : GitWorkspaces.find(id);
    if (Object.isNull(workspace))
      context.openDocument(Resources.workspaceDocumentName, Resources.openRepositoriesInstance, Resources.dashboardTitle);
    else
      context.openDocument(Resources.workspaceDocumentName, workspace.id, workspace.name);
  }

  public static openRepository(context: IWindowPartContext, folder: string): void {
    context.openDocument(Resources.historyDocumentName, folder, Resources.formatHistoryTitle(folder));
  }
}
