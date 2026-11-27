/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { IWindowPartContext } from "@noldova/desktop.window";
import { type GitRepositoryScan, ScanEnd } from "@noldova/git.protocol";
import type { DialogService } from "@noldova/ui.components.angular";

import { Resources } from "../../resources.ts";
import { GitRepositoryScanDialogComponent } from "../components/git-repository-scan-dialog/git-repository-scan-dialog.component.ts";
import { GitRecentRepositories } from "./git-recent-repositories.ts";
import { GitWorkspacePages } from "./git-workspace-pages.ts";

export class GitRepositoryScans {
  public static offer(dialogs: DialogService, folder: string, scan: GitRepositoryScan, add: (folders: readonly string[]) => void): void {
    const dialog = dialogs.open(GitRepositoryScanDialogComponent, ".open");
    dialog.componentRef?.setInput("folder", folder);
    dialog.componentRef?.setInput("repositories", scan.repositories);
    dialog.componentRef?.setInput("end", scan.end);
    dialog.componentInstance?.answered.subscribe(chosen => {
      dialog.close();
      if (!Object.isNull(chosen))
        add(chosen);
    });
  }

  public static offerToDashboard(dialogs: DialogService, context: IWindowPartContext, folder: string, scan: GitRepositoryScan): void {
    GitRepositoryScans.offer(dialogs, folder, scan, chosen => {
      for (const repository of chosen)
        GitRecentRepositories.remember(repository);
      GitWorkspacePages.open(context, null);
    });
  }

  public static belowTextOf(folder: string, scan: GitRepositoryScan): string {
    if (scan.repositories.length > 0)
      return Resources.formatChooseBelow(folder);
    if (scan.end === ScanEnd.Unreadable)
      return Resources.formatUnreadableBelow(folder);
    return scan.end === ScanEnd.FolderLimit ? Resources.formatNoneInFirstBelow(folder) : Resources.formatNoneBelow(folder);
  }
}
