/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type StatusBarItem, StatusBarItemState } from "@noldova/desktop.window";
import { type GitCommand, GitFolderParams, type GitStatus } from "@noldova/git.protocol";

import { Resources } from "../../resources.ts";

/**
 * The window's status-bar items for the Git panel's repository: its branch, or detached commit, with how far it is ahead of and behind its upstream,
 * how long ago it last fetched, and the last git command a write ran there, which opens the command log.
 */
export class GitStatusBar {
  private static readonly HIDDEN: StatusBarItemState = new StatusBarItemState("", { isHidden: true });
  private static readonly MINUTE: number = 60_000;
  private static items: readonly [StatusBarItem, StatusBarItem, StatusBarItem] | null = null;
  private static folder: string | null = null;
  private static status: GitStatus | null = null;
  private static commandFolder: string | null = null;
  private static command: GitCommand | null = null;

  /** Takes the branch, fetch and command items the window part registered, and keeps the fetch age current; the returned function lets them go again. */
  public static provide(branch: StatusBarItem, fetched: StatusBarItem, command: StatusBarItem): () => void {
    const items: readonly [StatusBarItem, StatusBarItem, StatusBarItem] = [branch, fetched, command];
    GitStatusBar.items = items;
    const timer = setInterval(() => GitStatusBar.refresh(), GitStatusBar.MINUTE);
    return () => {
      clearInterval(timer);
      if (GitStatusBar.items === items)
        GitStatusBar.items = null;
    };
  }

  /** Shows the folder's status, or hides the items while there is no repository or its status isn't read. */
  public static show(folder: string | null, status: GitStatus | null): void {
    GitStatusBar.folder = folder;
    GitStatusBar.status = status;
    GitStatusBar.refresh();
  }

  /** Shows the last command the folder's writes ran, or the command log's name before the first; hidden without a folder. */
  public static showCommand(folder: string | null, command: GitCommand | null): void {
    GitStatusBar.commandFolder = folder;
    GitStatusBar.command = command;
    GitStatusBar.items?.[2].update(GitStatusBar.commandStateOf(folder, command));
  }

  public static commandStateOf(folder: string | null, command: GitCommand | null): StatusBarItemState {
    if (Object.isNull(folder))
      return GitStatusBar.HIDDEN;
    return new StatusBarItemState(Object.isNull(command) ? Resources.commandLogLabel : Resources.formatCommandItem(command.line), {
      icon: Resources.commandLogIcon,
      tooltip: Object.isNull(command) ? Resources.openCommandLogTitle : Resources.formatCommandItemTooltip(command.line, command.exitCode, command.milliseconds),
      command: Resources.openCommandLogCommand,
      commandArguments: new GitFolderParams(folder).toJson()
    });
  }

  public static stateOf(folder: string | null, status: GitStatus | null): StatusBarItemState {
    if (Object.isNull(folder) || Object.isNull(status))
      return GitStatusBar.HIDDEN;
    const name = status.branch ?? (Object.isNull(status.head) ? null : Resources.formatDetachedAt(status.head.slice(0, Resources.shortIdLength)));
    if (Object.isNull(name))
      return GitStatusBar.HIDDEN;
    const upstream = status.upstream;
    const text = Object.isNull(upstream) ? name : `${name} ${Resources.formatAhead(upstream.ahead)} ${Resources.formatBehind(upstream.behind)}`;
    return new StatusBarItemState(text, {
      icon: Object.isNull(status.branch) ? Resources.detachedHeadIcon : Resources.statusBarBranchIcon,
      tooltip: Resources.formatStatusBarTooltip(name, upstream?.name ?? null, upstream?.ahead ?? 0, upstream?.behind ?? 0),
      command: Resources.openHistoryCommand,
      commandArguments: new GitFolderParams(folder).toJson()
    });
  }

  /** How long before `now` the repository last fetched, with the time itself as the tooltip; hidden while it never has. */
  public static fetchedStateOf(folder: string | null, status: GitStatus | null, now: Date): StatusBarItemState {
    const fetchedAt = Object.isNull(folder) ? null : status?.fetchedAt ?? null;
    if (Object.isNull(fetchedAt))
      return GitStatusBar.HIDDEN;
    const time = new Date(fetchedAt);
    return new StatusBarItemState(Resources.formatFetched(Math.floor((now.getTime() - time.getTime()) / GitStatusBar.MINUTE)), {
      tooltip: Resources.formatFetchedTooltip(time.toLocaleString(Resources.dateLocale))
    });
  }

  private static refresh(): void {
    GitStatusBar.items?.[0].update(GitStatusBar.stateOf(GitStatusBar.folder, GitStatusBar.status));
    GitStatusBar.items?.[1].update(GitStatusBar.fetchedStateOf(GitStatusBar.folder, GitStatusBar.status, new Date()));
    GitStatusBar.items?.[2].update(GitStatusBar.commandStateOf(GitStatusBar.commandFolder, GitStatusBar.command));
  }
}
