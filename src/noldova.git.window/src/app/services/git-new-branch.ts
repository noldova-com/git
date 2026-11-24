/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DialogService } from "@noldova/ui.components.angular";

import { GitBulkBranchDialogComponent } from "../components/git-bulk-branch-dialog/git-bulk-branch-dialog.component.ts";

/** Asks for the name of a new branch in one repository, in the dialog that names the repositories a branch goes into. */
export class GitNewBranch {
  /** The name the person gives on Create, or null on Cancel, Close or Escape. */
  public static askAsync(dialogs: DialogService, repository: string): Promise<string | null> {
    const dialog = dialogs.open(GitBulkBranchDialogComponent, ".name");
    dialog.componentRef?.setInput("repositories", [repository]);
    return new Promise(resolve => {
      dialog.componentInstance?.answered.subscribe(name => {
        dialog.close();
        resolve(name);
      });
    });
  }
}
