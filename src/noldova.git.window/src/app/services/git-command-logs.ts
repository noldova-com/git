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
import { GitWindowStorage } from "./git-window-storage.ts";

/**
 * The repositories whose command log is open, kept in the window's storage, so the window part reopens each log where the person left it: a log's tab
 * is a view's instance, and the window closes a saved instance tab that activation doesn't reopen.
 */
export class GitCommandLogs {
  private static readonly KEY: string = "git.commandLogs";
  private static folders: readonly string[] = [];

  /** Reopens the logs kept in the window's storage, and forgets each one the person closes; the window part calls it while it activates. */
  public static restore(context: IWindowPartContext): void {
    GitCommandLogs.folders = GitWindowStorage.readArray(GitCommandLogs.KEY).filter((t): t is string => Object.isString(t) && t.trim() !== "");
    context.onViewClosed(Resources.commandLogViewName, GitCommandLogs.forget);
    for (const folder of GitCommandLogs.folders)
      context.openView(Resources.commandLogViewName, folder, Resources.formatCommandLogTitle(folder));
  }

  /** Opens a repository's log, or brings it forward where it is, and keeps it among the open ones. */
  public static open(context: IWindowPartContext, folder: string): void {
    context.openView(Resources.commandLogViewName, folder, Resources.formatCommandLogTitle(folder));
    if (!GitCommandLogs.folders.includes(folder))
      GitCommandLogs.save([...GitCommandLogs.folders, folder]);
  }

  private static forget(folder: string): void {
    GitCommandLogs.save(GitCommandLogs.folders.filter(t => t !== folder));
  }

  private static save(folders: readonly string[]): void {
    GitCommandLogs.folders = folders;
    GitWindowStorage.write(GitCommandLogs.KEY, [...folders]);
  }
}
