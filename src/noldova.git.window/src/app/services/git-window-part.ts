/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { CommandContribution, ContentPadding, DockSide, DocumentContribution, type IWindowPart, type IWindowPartContext, SettingsPageContribution, SettingsRow,
  StatusBarItemContribution, StatusBarSide, ViewContribution } from "@noldova/desktop.window";
import { GitFolderParams, GitNames, type JsonValue } from "@noldova/git.protocol";

import type { IProvidedGitHostAccount } from "../interfaces/i-provided-git-host-account.ts";
import { Resources } from "../../resources.ts";
import { GitAvatars } from "./git-avatars.ts";
import { GitCommandLogs } from "./git-command-logs.ts";
import { GitCommitDetails } from "./git-commit-details.ts";
import { GitConflictDetails } from "./git-conflict-details.ts";
import { GitGravatars } from "./git-gravatars.ts";
import { GitHostAccounts } from "./git-host-accounts.ts";
import { GitLastWriteUndo } from "./git-last-write-undo.ts";
import { GitRebasePreviews } from "./git-rebase-previews.ts";
import { GitRebasing } from "./git-rebasing.ts";
import { GitRecentRepositories } from "./git-recent-repositories.ts";
import { GitRuntimeClient } from "./git-runtime-client.ts";
import { GitStatusBar } from "./git-status-bar.ts";
import { GitStatusFollower } from "./git-status-follower.ts";
import { GitWindowContext } from "./git-window-context.ts";
import { GitWorkspaceAcrossViews } from "./git-workspace-across-views.ts";
import { GitWorkspacePages } from "./git-workspace-pages.ts";
import { GitWorkspaces } from "./git-workspaces.ts";

export class GitWindowPart implements IWindowPart {
  private context: IWindowPartContext | null = null;
  private withdrawGravatars: (() => void) | null = null;
  private withdrawStatusBar: (() => void) | null = null;
  private unfollowStatus: (() => void) | null = null;
  private withdrawDetailViews: (() => void) | null = null;
  private unfollowAccounts: (() => void) | null = null;
  private withdrawUndo: (() => void) | null = null;
  private withdrawContext: (() => void) | null = null;

  public readonly moduleId: string = GitNames.moduleId;
  public readonly padding: ContentPadding = ContentPadding.None;

  public get isActive(): boolean {
    return !Object.isNull(this.context);
  }

  public async activateAsync(context: IWindowPartContext): Promise<void> {
    this.context = context;
    this.withdrawContext = GitWindowContext.provide(context);
    this.withdrawGravatars = GitAvatars.provideFallback(new GitGravatars(new GitRuntimeClient(context)));
    context.registerView(new ViewContribution(Resources.viewName, Resources.viewTitle, Resources.viewIcon, DockSide.Right, true,
      () => import("../components/git-view/git-view.component.ts").then(t => t.GitViewComponent), ContentPadding.None,
      { defaultGroup: Resources.viewDefaultGroup, defaultOrder: Resources.viewDefaultOrder }));
    context.registerView(new ViewContribution(Resources.repositoryViewName, Resources.repositoryViewTitle, Resources.repositoryViewIcon, DockSide.Left, true,
      () => import("../components/git-repository/git-repository.component.ts").then(t => t.GitRepositoryComponent), ContentPadding.None,
      { defaultGroup: Resources.repositoryViewDefaultGroup, defaultOrder: Resources.repositoryViewDefaultOrder }));
    context.registerView(new ViewContribution(Resources.workspacesViewName, Resources.workspacesHeading, Resources.dashboardIcon, DockSide.Left, true,
      () => import("../components/git-workspaces/git-workspaces.component.ts").then(t => t.GitWorkspacesComponent), ContentPadding.None,
      { defaultGroup: Resources.workspacesViewDefaultGroup, defaultOrder: Resources.workspacesViewDefaultOrder }));
    context.registerDocument(new DocumentContribution(Resources.historyDocumentName,
      () => import("../components/git-history/git-history.component.ts").then(t => t.GitHistoryComponent), ContentPadding.None));
    context.registerDocument(new DocumentContribution(Resources.conflictsDocumentName,
      () => import("../components/git-conflicts/git-conflicts.component.ts").then(t => t.GitConflictsComponent), ContentPadding.None));
    context.registerDocument(new DocumentContribution(Resources.rebaseDocumentName,
      () => import("../components/git-rebase/git-rebase.component.ts").then(t => t.GitRebaseComponent), ContentPadding.None));
    context.registerView(new ViewContribution(Resources.commandLogViewName, Resources.commandLogLabel, Resources.commandLogIcon, DockSide.Bottom, false,
      () => import("../components/git-command-log/git-command-log.component.ts").then(t => t.GitCommandLogComponent), ContentPadding.Default,
      { hasInstances: true, defaultGroup: Resources.commandLogDefaultGroup, defaultOrder: Resources.commandLogDefaultOrder }));
    context.registerView(new ViewContribution(Resources.commitDetailViewName, Resources.commitDetailLabel, Resources.commitDetailIcon, DockSide.Right, true,
      () => import("../components/git-commit-detail-view/git-commit-detail-view.component.ts").then(t => t.GitCommitDetailViewComponent), ContentPadding.None,
      { defaultGroup: Resources.commitDetailDefaultGroup, defaultOrder: Resources.commitDetailDefaultOrder }));
    context.registerView(new ViewContribution(Resources.conflictDetailViewName, Resources.conflictDetailLabel, Resources.conflictIcon, DockSide.Right, false,
      () => import("../components/git-conflict-detail/git-conflict-detail.component.ts").then(t => t.GitConflictDetailComponent), ContentPadding.None,
      { hasInstances: true, defaultGroup: Resources.conflictDetailDefaultGroup, defaultOrder: Resources.conflictDetailDefaultOrder }));
    context.registerView(new ViewContribution(Resources.rebasePreviewViewName, Resources.rebasePreviewLabel, Resources.rebasePreviewIcon, DockSide.Right, false,
      () => import("../components/git-rebase-preview/git-rebase-preview.component.ts").then(t => t.GitRebasePreviewComponent), ContentPadding.None,
      { hasInstances: true, defaultGroup: Resources.rebasePreviewDefaultGroup, defaultOrder: Resources.rebasePreviewDefaultOrder }));
    const withdrawCommitDetail: () => void = GitCommitDetails.of(context).listen();
    const withdrawConflictDetail: () => void = GitConflictDetails.of(context).listen();
    const withdrawRebasePreview: () => void = GitRebasePreviews.of(context).listen();
    this.withdrawDetailViews = () => {
      withdrawCommitDetail();
      withdrawConflictDetail();
      withdrawRebasePreview();
    };
    context.registerCommand(new CommandContribution(Resources.openHistoryCommand, Resources.openHistoryTitle, Resources.historyIcon, null,
      async (commandArguments: JsonValue) => {
        GitWorkspacePages.openRepository(context, GitFolderParams.fromJson(commandArguments).folder);
        return null;
      }));
    context.registerCommand(new CommandContribution(Resources.openCommandLogCommand, Resources.openCommandLogTitle, Resources.commandLogIcon, null,
      async (commandArguments: JsonValue) => {
        GitCommandLogs.open(context, GitFolderParams.fromJson(commandArguments).folder);
        return null;
      }));
    context.registerCommand(new CommandContribution(Resources.openConflictsCommand, Resources.openConflictsTitle, Resources.conflictIcon, null,
      async (commandArguments: JsonValue) => {
        const folder: string = GitFolderParams.fromJson(commandArguments).folder;
        context.openDocument(Resources.conflictsDocumentName, folder, Resources.formatConflictsTitle(folder));
        return null;
      }));
    GitCommandLogs.restore(context);
    GitRecentRepositories.restore();
    GitWorkspaces.restore();
    GitRebasing.restore();
    context.registerDocument(new DocumentContribution(Resources.workspaceDocumentName,
      () => import("../components/git-workspace/git-workspace.component.ts").then(t => t.GitWorkspaceComponent), ContentPadding.None));
    context.registerDocument(new DocumentContribution(Resources.workspaceAcrossDocumentName,
      () => import("../components/git-workspace-across-view/git-workspace-across-view.component.ts").then(t => t.GitWorkspaceAcrossViewComponent), ContentPadding.None));
    context.registerCommand(new CommandContribution(Resources.openWorkspaceCommand, Resources.openDashboardTitle, Resources.dashboardIcon, null,
      async (commandArguments: JsonValue) => {
        GitWorkspacePages.open(context, Object.isNull(commandArguments) ? null : JsonReader.fromValue(commandArguments).readNullableString("id"));
        return null;
      }));
    context.registerCommand(new CommandContribution(Resources.openAcrossCommand, Resources.acrossHeading, Resources.workspaceAcrossIcon, null, async () => {
      GitWorkspaceAcrossViews.open(context);
      return null;
    }));
    context.registerSettingsPage(new SettingsPageContribution(Resources.accountsPage,
      () => import("../components/git-accounts/git-accounts.component.ts").then(t => t.GitAccountsComponent)));
    this.unfollowAccounts = GitHostAccounts.follow(accounts => {
      context.setSettingsRows(Resources.accountsPage, GitWindowPart.accountRowsOf(accounts));
    });
    this.withdrawStatusBar = GitStatusBar.provide(
      context.registerStatusBarItem(new StatusBarItemContribution(Resources.statusBarItemName, StatusBarSide.Left, GitStatusBar.stateOf(null, null))),
      context.registerStatusBarItem(new StatusBarItemContribution(Resources.fetchedItemName, StatusBarSide.Left, GitStatusBar.fetchedStateOf(null, null, new Date()))),
      context.registerStatusBarItem(new StatusBarItemContribution(Resources.commandItemName, StatusBarSide.Right, GitStatusBar.commandStateOf(null, null))));
    this.unfollowStatus = GitStatusFollower.follow(context);
    this.withdrawUndo = GitLastWriteUndo.provide(context);
  }

  public async reconnectAsync(): Promise<boolean> {
    return !Object.isNull(this.context);
  }

  public async deactivateAsync(): Promise<void> {
    this.withdrawGravatars?.();
    this.withdrawGravatars = null;
    this.unfollowStatus?.();
    this.unfollowStatus = null;
    this.withdrawStatusBar?.();
    this.withdrawStatusBar = null;
    this.withdrawDetailViews?.();
    this.withdrawDetailViews = null;
    this.unfollowAccounts?.();
    this.unfollowAccounts = null;
    this.withdrawUndo?.();
    this.withdrawUndo = null;
    this.withdrawContext?.();
    this.withdrawContext = null;
    this.context = null;
  }

  private static accountRowsOf(accounts: readonly IProvidedGitHostAccount[]): SettingsRow[] {
    return accounts.map(t => new SettingsRow(`${Resources.accountRowPrefix}${t.account.id}`, Resources.formatAccountRowTitle(t.account.host),
      Resources.formatAccountRowNote(t.account.host)));
  }
}

export const windowPart: IWindowPart = new GitWindowPart();
