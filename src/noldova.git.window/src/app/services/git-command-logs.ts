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

export class GitCommandLogs {
  private static readonly KEY: string = "git.commandLogs";
  private static folders: readonly string[] = [];

  public static restore(context: IWindowPartContext): void {
    GitCommandLogs.folders = GitWindowStorage.readArray(GitCommandLogs.KEY).filter((t): t is string => Object.isString(t) && t.trim() !== "");
    context.onViewClosed(Resources.commandLogViewName, GitCommandLogs.forget);
    for (const folder of GitCommandLogs.folders)
      context.openView(Resources.commandLogViewName, folder, Resources.formatCommandLogTitle(folder));
  }

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
