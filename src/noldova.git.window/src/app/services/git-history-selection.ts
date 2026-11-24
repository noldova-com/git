/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWindowPartContext } from "@noldova/desktop.window";
import { GitFolderParams } from "@noldova/git.protocol";

import { Resources } from "../../resources.ts";
import { GitHistoryAsks } from "./git-history-asks.ts";

/** Lets another module's page show a commit in a repository's history. */
export class GitHistorySelection {
  /** Opens the repository's history through the Git module's command, and selects the commit there once it has read it; a history that hasn't, says so. */
  public static async selectAsync(context: IWindowPartContext, folder: string, commitId: string): Promise<void> {
    GitHistoryAsks.ask(folder, commitId);
    await context.runCommandAsync(Resources.openHistoryCommand, new GitFolderParams(folder).toJson());
  }
}
