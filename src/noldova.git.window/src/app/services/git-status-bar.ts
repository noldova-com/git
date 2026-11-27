/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type IWindowPartContext, type StatusBarItem, StatusBarItemState, type TimeFormatService } from "@noldova/desktop.window";
import { type GitCommand, GitFolderParams, type GitStatus } from "@noldova/git.protocol";

import { Resources } from "../../resources.ts";
import { GitStatusBarItems } from "../models/git-status-bar-items.ts";

export class GitStatusBar {
  private static readonly HIDDEN: StatusBarItemState = new StatusBarItemState("", { isHidden: true });
  private static readonly MINUTE: number = 60_000;
  private static items: GitStatusBarItems | null = null;
  private static folder: string | null = null;
  private static status: GitStatus | null = null;
  private static commandFolder: string | null = null;
  private static command: GitCommand | null = null;

  // The fetched item's tooltip shows its time by the time and date format settings, so a change of either draws the items again.
  public static provide(context: IWindowPartContext, branch: StatusBarItem, fetched: StatusBarItem, command: StatusBarItem): () => void {
    const items: GitStatusBarItems = new GitStatusBarItems(branch, fetched, command, context.timeFormats);
    GitStatusBar.items = items;
    const timer = setInterval(() => GitStatusBar.refresh(), GitStatusBar.MINUTE);
    const unwatch: readonly (() => void)[] = Resources.timeSettings.map(t => context.onSettingChanged(t, () => GitStatusBar.refresh()));
    return () => {
      clearInterval(timer);
      for (const stop of unwatch)
        stop();
      if (GitStatusBar.items === items)
        GitStatusBar.items = null;
    };
  }

  public static show(folder: string | null, status: GitStatus | null): void {
    GitStatusBar.folder = folder;
    GitStatusBar.status = status;
    GitStatusBar.refresh();
  }

  public static showCommand(folder: string | null, command: GitCommand | null): void {
    GitStatusBar.commandFolder = folder;
    GitStatusBar.command = command;
    GitStatusBar.items?.command.update(GitStatusBar.commandStateOf(folder, command));
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

  public static fetchedStateOf(folder: string | null, status: GitStatus | null, now: Date, dates: TimeFormatService): StatusBarItemState {
    const fetchedAt = Object.isNull(folder) ? null : status?.fetchedAt ?? null;
    if (Object.isNull(fetchedAt))
      return GitStatusBar.HIDDEN;
    const time = new Date(fetchedAt);
    return new StatusBarItemState(Resources.formatFetched(Math.floor((now.getTime() - time.getTime()) / GitStatusBar.MINUTE)), {
      tooltip: Resources.formatFetchedTooltip(dates.dateTime(fetchedAt))
    });
  }

  private static refresh(): void {
    const items: GitStatusBarItems | null = GitStatusBar.items;
    if (Object.isNull(items))
      return;
    items.branch.update(GitStatusBar.stateOf(GitStatusBar.folder, GitStatusBar.status));
    items.fetched.update(GitStatusBar.fetchedStateOf(GitStatusBar.folder, GitStatusBar.status, new Date(), items.dates));
    items.command.update(GitStatusBar.commandStateOf(GitStatusBar.commandFolder, GitStatusBar.command));
  }
}
