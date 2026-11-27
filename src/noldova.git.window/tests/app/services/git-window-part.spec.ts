/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal } from "@angular/core";
import "@noldova/context.core";
import { type CommandContribution, ContentPadding, DockSide, type DocumentContribution, type SettingsPageContribution, SettingsRow, StatusBarItem, StatusBarSide, type ViewContribution } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { describe, expect, it, onTestFinished } from "vitest";

import { GitAccountsComponent } from "../../../src/app/components/git-accounts/git-accounts.component.ts";
import { GitConflictsComponent } from "../../../src/app/components/git-conflicts/git-conflicts.component.ts";
import { GitRebaseComponent } from "../../../src/app/components/git-rebase/git-rebase.component.ts";
import { GitRebasePreviewComponent } from "../../../src/app/components/git-rebase-preview/git-rebase-preview.component.ts";
import { GitCommandLogComponent } from "../../../src/app/components/git-command-log/git-command-log.component.ts";
import { GitCommitDetailViewComponent } from "../../../src/app/components/git-commit-detail-view/git-commit-detail-view.component.ts";
import { GitConflictDetailComponent } from "../../../src/app/components/git-conflict-detail/git-conflict-detail.component.ts";
import { GitHistoryComponent } from "../../../src/app/components/git-history/git-history.component.ts";
import { GitRepositoryComponent } from "../../../src/app/components/git-repository/git-repository.component.ts";
import { GitWorkspacesComponent } from "../../../src/app/components/git-workspaces/git-workspaces.component.ts";
import { GitViewComponent } from "../../../src/app/components/git-view/git-view.component.ts";
import { GitWorkspaceComponent } from "../../../src/app/components/git-workspace/git-workspace.component.ts";
import { GitWorkspaceAcrossViewComponent } from "../../../src/app/components/git-workspace-across-view/git-workspace-across-view.component.ts";
import { GitHostFeature } from "../../../src/app/enums/git-host-feature.ts";
import type { IGitHostAccount } from "../../../src/app/interfaces/i-git-host-account.ts";
import { GitAvatars } from "../../../src/app/services/git-avatars.ts";
import { GitHostAccounts } from "../../../src/app/services/git-host-accounts.ts";
import { GitRebaseTarget, GitRebasing } from "../../../src/app/services/git-rebasing.ts";
import { GitRecentRepositories } from "../../../src/app/services/git-recent-repositories.ts";
import { GitStatusBar } from "../../../src/app/services/git-status-bar.ts";
import { GitWindowPart } from "../../../src/app/services/git-window-part.ts";
import { GitWorkspaces } from "../../../src/app/services/git-workspaces.ts";
import { GitFixtures } from "../../fixtures/git-fixtures.fixture.ts";
import { Resources } from "../../../src/resources.ts";
import menus from "../../../../noldova.git/menus.json" with { type: "json" };
import manifest from "../../../../noldova.git/module.json" with { type: "json" };

@Component({ selector: "nol-git-test-sign-in", template: "" })
class TestSignInComponent {
}

function accountOf(id: string, host: string): IGitHostAccount {
  return { id, host, column: host, mark: host.slice(0, 2), markColor: "#000000", cards: signal([]), signIn: TestSignInComponent, features: [GitHostFeature.PullRequests] };
}

describe("GitWindowPart", () => {
  it("reconnects only while it is active", async () => {
    const part: GitWindowPart = new GitWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    context.allow("provideUndo");
    context.allow("registerSettingsPage");
    context.allow("setSettingsRows");
    context.allow("onViewClosed");
    context.allow("onEvent");
    context.beStrict();
    context.answer("registerStatusBarItem", t => new StatusBarItem(t, () => undefined));
    context.allow("registerView");
    context.allow("registerDocument");
    context.allow("registerCommand");

    await part.deactivateAsync();
    const answers: boolean[] = [await part.reconnectAsync()];
    await part.activateAsync(context);
    answers.push(await part.reconnectAsync(), part.isActive);
    await part.deactivateAsync();
    answers.push(await part.reconnectAsync(), part.isActive);

    expect(answers).toEqual([false, true, true, false, false]);
    expect(GitAvatars.imageOf("/repository", "kim@example.com", "a1")).toBeNull();
    expect(context.calls.map(t => t.member)).toEqual(["registerView", "registerView", "registerView", "registerDocument", "registerDocument", "registerDocument", "registerView",
      "registerView", "registerView", "registerView", "registerView", "onViewClosed", "onViewClosed", "onViewClosed", "registerCommand", "registerCommand", "registerCommand", "onViewClosed",
      "registerDocument", "registerDocument", "registerCommand", "registerCommand", "registerSettingsPage", "setSettingsRows", "registerStatusBarItem",
      "registerStatusBarItem", "registerStatusBarItem", "onEvent", "provideUndo", "onEvent"]);
    expect([context.activeCallsOf("onEvent").length, context.activeCallsOf("provideUndo").length]).toEqual([0, 0]);
  });

  it("registers only the views, documents and commands its module declares", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    context.allow("provideUndo");
    const views: string[] = [];
    const documents: string[] = [];
    const commands: string[] = [];
    context.answer("registerView", t => {
      views.push(t.name);
    });
    context.answer("registerDocument", t => {
      documents.push(t.name);
    });
    context.answer("registerCommand", t => {
      commands.push(t.name);
    });
    context.allow("registerSettingsPage");
    context.allow("setSettingsRows");
    context.allow("onViewClosed");
    context.allow("onEvent");
    context.beStrict();
    context.answer("registerStatusBarItem", t => new StatusBarItem(t, () => undefined));

    const part: GitWindowPart = new GitWindowPart();
    await part.activateAsync(context);
    onTestFinished(() => part.deactivateAsync());

    expect([views, documents, commands]).toEqual([manifest.contributes.views, manifest.contributes.documents, manifest.contributes.commands]);
  });

  it("gives the Git view Gravatar's pictures as the fallback while it is active", async () => {
    const part: GitWindowPart = new GitWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    context.allow("provideUndo");
    GitFixtures.answerWith(context, { "git.avatar": { image: "data:image/png;base64,QQ==" } });
    context.answer("registerStatusBarItem", t => new StatusBarItem(t, () => undefined));

    await part.activateAsync(context);
    GitAvatars.imageOf("/repository", "kim@example.com", "a1");
    await GitFixtures.untilAsync(() => !Object.isNull(GitAvatars.imageOf("/repository", "kim@example.com", "a1")));
    const shown = GitAvatars.imageOf("/repository", "kim@example.com", "a1");
    await part.deactivateAsync();

    expect([shown, GitAvatars.imageOf("/repository", "kim@example.com", "a1")]).toEqual(["data:image/png;base64,QQ==", null]);
  });

  it("registers the Git view in the right dock's first group at order 20, shown by default, with no padding, loading the view's component", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    context.allow("provideUndo");
    const views: ViewContribution[] = [];
    context.answer("registerView", t => {
      views.push(t);
    });
    context.allow("registerDocument");
    context.allow("registerCommand");
    context.allow("registerSettingsPage");
    context.allow("setSettingsRows");
    context.allow("onViewClosed");
    context.allow("onEvent");
    context.beStrict();
    context.answer("registerStatusBarItem", t => new StatusBarItem(t, () => undefined));

    const part: GitWindowPart = new GitWindowPart();
    await part.activateAsync(context);
    onTestFinished(() => part.deactivateAsync());
    const [view] = views;

    expect([view?.name, view?.title, view?.icon, view?.defaultSide, view?.isShownByDefault, view?.padding, view?.defaultGroup, view?.defaultOrder])
      .toEqual(["git.view", "Git", "account_tree", DockSide.Right, true, ContentPadding.None, 0, 20]);
    expect(await view?.loadComponent()).toBe(GitViewComponent);
    expect(context.callsOf("registerView")).toEqual([[view], [views[1]], [views[2]], [views[3]], [views[4]], [views[5]], [views[6]]]);
  });

  it("registers the repository view in the left dock's first group at order 20, after the Workspaces view, shown by default, with no padding, loading its component", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    context.allow("provideUndo");
    const views: ViewContribution[] = [];
    context.answer("registerView", t => {
      views.push(t);
    });
    context.allow("registerDocument");
    context.allow("registerCommand");
    context.allow("registerSettingsPage");
    context.allow("setSettingsRows");
    context.allow("onViewClosed");
    context.allow("onEvent");
    context.beStrict();
    context.answer("registerStatusBarItem", t => new StatusBarItem(t, () => undefined));

    const part: GitWindowPart = new GitWindowPart();
    await part.activateAsync(context);
    onTestFinished(() => part.deactivateAsync());
    const view: ViewContribution | undefined = views[1];

    expect([view?.name, view?.title, view?.icon, view?.defaultSide, view?.isShownByDefault, view?.padding, view?.defaultGroup, view?.defaultOrder])
      .toEqual(["git.repository", "Repository", "folder", DockSide.Left, true, ContentPadding.None, 0, 20]);
    expect(await view?.loadComponent()).toBe(GitRepositoryComponent);
  });

  it("registers the Workspaces view in the left dock's first group at order 10, first, shown by default, with no padding, loading its component", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    context.allow("provideUndo");
    const views: ViewContribution[] = [];
    context.answer("registerView", t => {
      views.push(t);
    });
    context.allow("registerDocument");
    context.allow("registerCommand");
    context.allow("registerSettingsPage");
    context.allow("setSettingsRows");
    context.allow("onViewClosed");
    context.allow("onEvent");
    context.beStrict();
    context.answer("registerStatusBarItem", t => new StatusBarItem(t, () => undefined));

    const part: GitWindowPart = new GitWindowPart();
    await part.activateAsync(context);
    onTestFinished(() => part.deactivateAsync());
    const view: ViewContribution | undefined = views[2];

    expect([view?.name, view?.title, view?.icon, view?.defaultSide, view?.isShownByDefault, view?.padding, view?.defaultGroup, view?.defaultOrder])
      .toEqual(["git.workspaces", "Workspaces", "dashboard", DockSide.Left, true, ContentPadding.None, 0, 10]);
    expect(await view?.loadComponent()).toBe(GitWorkspacesComponent);
  });

  it("registers the command log as a view with an instance per repository, in the bottom dock's first group at order 20, hidden by default, with the app's padding for a docked view, as other views have, loading its component", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    context.allow("provideUndo");
    const views: ViewContribution[] = [];
    context.answer("registerView", t => {
      views.push(t);
    });
    context.allow("registerDocument");
    context.allow("registerCommand");
    context.allow("registerSettingsPage");
    context.allow("setSettingsRows");
    context.allow("onViewClosed");
    context.allow("onEvent");
    context.beStrict();
    context.answer("registerStatusBarItem", t => new StatusBarItem(t, () => undefined));

    const part: GitWindowPart = new GitWindowPart();
    await part.activateAsync(context);
    onTestFinished(() => part.deactivateAsync());
    const view: ViewContribution | undefined = views[3];

    expect([view?.name, view?.title, view?.icon, view?.defaultSide, view?.isShownByDefault, view?.padding, view?.hasInstances, view?.defaultGroup, view?.defaultOrder])
      .toEqual(["git.commands", "Command log", "receipt_long", DockSide.Bottom, false, ContentPadding.Default, true, 0, 20]);
    expect(await view?.loadComponent()).toBe(GitCommandLogComponent);
  });

  it("registers the Commit view with one instance, in the right dock's first group at order 45, hidden by default, with no padding, loading its component, and follows its closing", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    context.allow("provideUndo");
    const views: ViewContribution[] = [];
    context.answer("registerView", t => {
      views.push(t);
    });
    context.allow("registerDocument");
    context.allow("registerCommand");
    context.allow("registerSettingsPage");
    context.allow("setSettingsRows");
    context.allow("onViewClosed");
    context.allow("onEvent");
    context.beStrict();
    context.answer("registerStatusBarItem", t => new StatusBarItem(t, () => undefined));

    const part: GitWindowPart = new GitWindowPart();
    await part.activateAsync(context);
    onTestFinished(() => part.deactivateAsync());
    const view: ViewContribution | undefined = views[4];

    expect([view?.name, view?.title, view?.icon, view?.defaultSide, view?.isShownByDefault, view?.padding, view?.hasInstances, view?.defaultGroup, view?.defaultOrder])
      .toEqual(["git.commitView", "Commit", "commit", DockSide.Right, true, ContentPadding.None, false, 0, 45]);
    expect(await view?.loadComponent()).toBe(GitCommitDetailViewComponent);
    expect(context.callsOf("onViewClosed").map(t => t[0])).not.toContain("git.commitView");
  });

  it("registers the Conflict view with one instance, in the right dock's first group at order 50, hidden by default, with no padding, loading its component, and follows its closing", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    context.allow("provideUndo");
    const views: ViewContribution[] = [];
    context.answer("registerView", t => {
      views.push(t);
    });
    context.allow("registerDocument");
    context.allow("registerCommand");
    context.allow("registerSettingsPage");
    context.allow("setSettingsRows");
    context.allow("onViewClosed");
    context.allow("onEvent");
    context.beStrict();
    context.answer("registerStatusBarItem", t => new StatusBarItem(t, () => undefined));

    const part: GitWindowPart = new GitWindowPart();
    await part.activateAsync(context);
    onTestFinished(() => part.deactivateAsync());
    const view: ViewContribution | undefined = views[5];

    expect([view?.name, view?.title, view?.icon, view?.defaultSide, view?.isShownByDefault, view?.padding, view?.hasInstances, view?.defaultGroup, view?.defaultOrder])
      .toEqual(["git.conflictDetail", "Conflict", "warning", DockSide.Right, false, ContentPadding.None, true, 0, 50]);
    expect(await view?.loadComponent()).toBe(GitConflictDetailComponent);
    expect(context.callsOf("onViewClosed").map(t => t[0])).toContain("git.conflictDetail");
  });

  it("registers the Rebase preview view with one instance, in the right dock's first group after the Conflict view, hidden by default, with no padding, loading its component, and follows its closing", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    context.allow("provideUndo");
    const views: ViewContribution[] = [];
    context.answer("registerView", t => {
      views.push(t);
    });
    context.allow("registerDocument");
    context.allow("registerCommand");
    context.allow("registerSettingsPage");
    context.allow("setSettingsRows");
    context.allow("onViewClosed");
    context.allow("onEvent");
    context.beStrict();
    context.answer("registerStatusBarItem", t => new StatusBarItem(t, () => undefined));

    const part: GitWindowPart = new GitWindowPart();
    await part.activateAsync(context);
    onTestFinished(() => part.deactivateAsync());
    const added: readonly ViewContribution[] = views.slice(6);

    expect(added.map(t => [t.name, t.title, t.icon, t.defaultSide, t.isShownByDefault, t.padding, t.hasInstances, t.defaultGroup, t.defaultOrder])).toEqual([
      ["git.rebasePreview", "Rebase preview", "low_priority", DockSide.Right, false, ContentPadding.None, true, 0, 60]
    ]);
    expect(await Promise.all(added.map(t => t.loadComponent()))).toEqual([GitRebasePreviewComponent]);
    expect(context.callsOf("onViewClosed").map(t => t[0])).toEqual(expect.arrayContaining(["git.rebasePreview"]));
    expect(context.callsOf("onViewClosed").map(t => t[0])).not.toContain("git.workspaceAcross");
  });

  it("registers Across repositories as a document in the middle, with no padding, loading its component, and a command, which the View menu runs, that opens its one tab, showing the open tab again rather than a second", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    context.allow("provideUndo");
    const documents: DocumentContribution[] = [];
    const commands: CommandContribution[] = [];
    context.allow("registerView");
    context.answer("registerDocument", t => {
      documents.push(t);
    });
    context.answer("registerCommand", t => {
      commands.push(t);
    });
    context.allow("openDocument");
    context.allow("registerSettingsPage");
    context.allow("setSettingsRows");
    context.allow("onViewClosed");
    context.allow("onEvent");
    context.beStrict();
    context.answer("registerStatusBarItem", t => new StatusBarItem(t, () => undefined));

    const part: GitWindowPart = new GitWindowPart();
    await part.activateAsync(context);
    onTestFinished(() => part.deactivateAsync());
    const across: DocumentContribution | undefined = documents.find(t => t.name === "git.workspaceAcross");
    const command: CommandContribution | undefined = commands.find(t => t.name === "git.openAcross");

    expect([across?.padding, await across?.loadComponent()]).toEqual([ContentPadding.None, GitWorkspaceAcrossViewComponent]);
    expect([command?.title, command?.icon, await command?.runAsync(null), await command?.runAsync(null)]).toEqual(["Across repositories", "hub", null, null]);
    expect(context.callsOf("openDocument")).toEqual([
      ["git.workspaceAcross", "selected", "Across repositories"],
      ["git.workspaceAcross", "selected", "Across repositories"]
    ]);
    expect(menus.groups.filter(t => t.place === "desktop.view").flatMap(t => t.items.map(u => u.command))).toEqual(["git.openAcross"]);
  });

  it("opens a repository's command log as the log view's instance, reopens the logs left open when it activates again, and forgets one the person closes", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    context.allow("provideUndo");
    const commands: CommandContribution[] = [];
    context.allow("registerView");
    context.allow("registerDocument");
    context.answer("registerCommand", t => {
      commands.push(t);
    });
    context.allow("openView");
    context.allow("registerSettingsPage");
    context.allow("setSettingsRows");
    context.allow("onViewClosed");
    context.allow("onEvent");
    context.beStrict();
    context.answer("registerStatusBarItem", t => new StatusBarItem(t, () => undefined));
    onTestFinished(() => localStorage.clear());
    localStorage.setItem("git.commandLogs", JSON.stringify(["/work/app", 7, " ", "C:\\Repos\\commitline\\"]));

    const part: GitWindowPart = new GitWindowPart();
    await part.activateAsync(context);
    onTestFinished(() => part.deactivateAsync());
    const restored: readonly (readonly unknown[])[] = context.callsOf("openView");
    const command: CommandContribution | undefined = commands[1];
    const ran: unknown[] = [command?.name, command?.title, command?.icon, await command?.runAsync({ folder: "/home/kim/site" }), await command?.runAsync({ folder: "/work/app" })];
    context.raiseViewClosed("git.commands", "/work/app");

    expect(restored).toEqual([["git.commands", "/work/app", "Command log: app"], ["git.commands", "C:\\Repos\\commitline\\", "Command log: commitline"]]);
    expect(ran).toEqual(["git.openCommandLog", "Open the command log", "receipt_long", null, null]);
    expect(context.callsOf("openView").slice(2)).toEqual([["git.commands", "/home/kim/site", "Command log: site"], ["git.commands", "/work/app", "Command log: app"]]);
    expect(JSON.parse(localStorage.getItem("git.commandLogs") ?? "null")).toEqual(["C:\\Repos\\commitline\\", "/home/kim/site"]);
  });

  it("registers the history, conflict and rebase documents, loading their components with no padding, and commands that open the history and the conflicts for a folder, leaving the repositories opened lately to the history's first read", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    context.allow("provideUndo");
    const documents: DocumentContribution[] = [];
    const commands: CommandContribution[] = [];
    context.allow("registerView");
    context.answer("registerDocument", t => {
      documents.push(t);
    });
    context.answer("registerCommand", t => {
      commands.push(t);
    });
    context.allow("openDocument");
    context.allow("registerSettingsPage");
    context.allow("setSettingsRows");
    context.allow("onViewClosed");
    context.allow("onEvent");
    context.beStrict();
    context.answer("registerStatusBarItem", t => new StatusBarItem(t, () => undefined));

    onTestFinished(() => {
      localStorage.clear();
      GitRecentRepositories.restore();
    });
    localStorage.setItem("git.recentRepositories", JSON.stringify(["/work/project"]));
    const part: GitWindowPart = new GitWindowPart();
    await part.activateAsync(context);
    onTestFinished(() => part.deactivateAsync());
    const [document] = documents;
    const [command] = commands;

    expect([document?.name, document?.padding]).toEqual(["git.history", ContentPadding.None]);
    expect(await document?.loadComponent()).toBe(GitHistoryComponent);
    expect([documents[1]?.name, documents[1]?.padding]).toEqual(["git.conflicts", ContentPadding.None]);
    expect(await documents[1]?.loadComponent()).toBe(GitConflictsComponent);
    expect([documents[2]?.name, documents[2]?.padding]).toEqual(["git.interactiveRebase", ContentPadding.None]);
    expect(await documents[2]?.loadComponent()).toBe(GitRebaseComponent);
    expect([commands[2]?.name, commands[2]?.title, commands[2]?.icon, await commands[2]?.runAsync({ folder: "/home/kim/site/" })]).toEqual([
      "git.openConflicts", "Open conflicts", "warning", null
    ]);
    await expect(commands[2]?.runAsync({ path: "/home/kim/site" })).rejects.toThrow();
    expect([command?.name, command?.title, command?.icon]).toEqual(["git.openHistory", "Open history", "history"]);
    expect(await command?.runAsync({ folder: "C:\\Repos\\commitline\\" })).toBeNull();
    expect(await command?.runAsync({ folder: "/home/kim/site" })).toBeNull();
    expect(context.callsOf("openDocument")).toEqual([
      ["git.conflicts", "/home/kim/site/", "Conflicts: site"],
      ["git.history", "C:\\Repos\\commitline\\", "commitline"],
      ["git.history", "/home/kim/site", "site"]
    ]);
    expect(GitRecentRepositories.recent()).toEqual(["/work/project"]);
  });

  it("reads the workspaces, the repositories opened lately and the rebase targets, and registers the workspace page and a command that opens a workspace's page or the open repositories'", async () => {
    localStorage.setItem("git.workspaces", JSON.stringify([{ id: "w1", name: "Sites", folders: ["/work/site"] }]));
    localStorage.setItem("git.recentRepositories", JSON.stringify(["/work/app"]));
    localStorage.setItem("git.rebaseTargets", JSON.stringify([{ folder: "/work/app", id: "a".repeat(40), name: "main" }]));
    onTestFinished(() => {
      localStorage.clear();
      GitWorkspaces.restore();
      GitRecentRepositories.restore();
      GitRebasing.restore();
    });
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    context.allow("provideUndo");
    const documents: DocumentContribution[] = [];
    const commands: CommandContribution[] = [];
    context.allow("registerView");
    context.answer("registerDocument", t => {
      documents.push(t);
    });
    context.answer("registerCommand", t => {
      commands.push(t);
    });
    context.allow("openDocument");
    context.allow("registerSettingsPage");
    context.allow("setSettingsRows");
    context.allow("onViewClosed");
    context.allow("onEvent");
    context.beStrict();
    context.answer("registerStatusBarItem", t => new StatusBarItem(t, () => undefined));

    const part: GitWindowPart = new GitWindowPart();
    await part.activateAsync(context);
    onTestFinished(() => part.deactivateAsync());
    const document: DocumentContribution | undefined = documents[3];
    const command: CommandContribution | undefined = commands[3];

    expect([GitWorkspaces.list().map(t => t.name), GitRecentRepositories.recent()]).toEqual([["Sites"], ["/work/app"]]);
    expect(GitRebasing.targetOf("/work/app")).toEqual(new GitRebaseTarget("a".repeat(40), "main"));
    expect([document?.name, document?.padding]).toEqual(["git.workspace", ContentPadding.None]);
    expect(await document?.loadComponent()).toBe(GitWorkspaceComponent);
    expect([command?.name, command?.title, command?.icon]).toEqual(["git.openWorkspace", "Open dashboard", "dashboard"]);
    expect([await command?.runAsync({ id: "w1" }), await command?.runAsync({ id: null }), await command?.runAsync(null), await command?.runAsync({ id: "gone" })])
      .toEqual([null, null, null, null]);
    expect(context.callsOf("openDocument")).toEqual([
      ["git.workspace", "w1", "Sites"],
      ["git.workspace", "open", "Dashboard"],
      ["git.workspace", "open", "Dashboard"],
      ["git.workspace", "open", "Dashboard"]
    ]);
  });

  it("registers the branch's and the fetch's status-bar items at the start and the command's at the end, hidden until the Git panel shows a repository, and lets them go when it deactivates", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    context.allow("provideUndo");
    const items: StatusBarItem[] = [];
    context.allow("registerView");
    context.allow("registerDocument");
    context.allow("registerCommand");
    context.answer("registerStatusBarItem", t => {
      const item: StatusBarItem = new StatusBarItem(t, () => undefined);
      items.push(item);
      return item;
    });

    const part: GitWindowPart = new GitWindowPart();
    await part.activateAsync(context);
    const [item, fetched, command] = items;
    const hidden: readonly (boolean | undefined)[] = [item?.state().isHidden, fetched?.state().isHidden, command?.state().isHidden];
    GitStatusBar.showCommand("/work/site", null);
    GitStatusBar.show("/work/site", GitFixtures.status([], null, { fetchedAt: new Date().toISOString().replace(/\.\d{3}Z$/u, "Z") }));
    const shown: readonly (string | undefined)[] = [item?.state().text, fetched?.state().text, command?.state().text];
    await part.deactivateAsync();
    GitStatusBar.show("/work/site", null);

    expect([item?.name, item?.side, fetched?.name, fetched?.side, command?.name, command?.side, hidden, shown, item?.state().isHidden]).toEqual([
      "git.branch", StatusBarSide.Left, "git.fetched", StatusBarSide.Left, "git.lastCommand", StatusBarSide.Right, [true, true, true],
      ["main", "Fetched just now", "Command log"], false
    ]);
  });

  it("declares each contributed name once across every kind, as the app's build requires", () => {
    const names: readonly string[] = Object.values(manifest.contributes).flat();

    expect(names.filter((t, i) => names.indexOf(t) !== i)).toEqual([]);
  });

  it("lists the terminal module as a dependency, since Noldova Desktop refuses a module's run of another's command it doesn't list", () => {
    const owner: string = Resources.newTerminalCommand.slice(0, Resources.newTerminalCommand.indexOf("."));

    expect(Object.keys(manifest.optionalDependencies)).toContain(owner);
  });

  it("refuses to open the history without a folder", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    context.allow("provideUndo");
    const commands: CommandContribution[] = [];
    context.allow("registerView");
    context.allow("registerDocument");
    context.answer("registerCommand", t => {
      commands.push(t);
    });
    context.allow("registerSettingsPage");
    context.allow("setSettingsRows");
    context.allow("onViewClosed");
    context.allow("onEvent");
    context.beStrict();
    context.answer("registerStatusBarItem", t => new StatusBarItem(t, () => undefined));

    const part: GitWindowPart = new GitWindowPart();
    await part.activateAsync(context);
    onTestFinished(() => part.deactivateAsync());

    await expect(commands[0]?.runAsync({})).rejects.toThrow();
    expect(context.callsOf("openDocument")).toEqual([]);
  });

  it("registers Accounts and hosts, the Settings page its module declares, loading the accounts' component", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    context.allow("provideUndo");
    const pages: SettingsPageContribution[] = [];
    context.allow("registerView");
    context.allow("registerDocument");
    context.allow("registerCommand");
    context.answer("registerSettingsPage", t => {
      pages.push(t);
    });
    context.allow("setSettingsRows");
    context.allow("onViewClosed");
    context.allow("onEvent");
    context.beStrict();
    context.answer("registerStatusBarItem", t => new StatusBarItem(t, () => undefined));

    const part: GitWindowPart = new GitWindowPart();
    await part.activateAsync(context);
    onTestFinished(() => part.deactivateAsync());

    expect(pages.map(t => t.name)).toEqual(manifest.contributes.settingsPages);
    expect(await pages[0]?.loadComponent()).toBe(GitAccountsComponent);
  });

  it("gives Settings search a row for each host's account while it is active, following the hosts, and none once it deactivates", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    context.allow("provideUndo");
    const host: FakeWindowPartContext = new FakeWindowPartContext();
    context.answer("registerStatusBarItem", t => new StatusBarItem(t, () => undefined));
    const withdrawGitHub: () => void = GitHostAccounts.provide(host, accountOf("git-github.account", "GitHub"));
    onTestFinished(withdrawGitHub);

    const part: GitWindowPart = new GitWindowPart();
    await part.activateAsync(context);
    const withdrawAzure: () => void = GitHostAccounts.provide(host, accountOf("git-azure-devops.account", "Azure DevOps"));
    withdrawAzure();
    await part.deactivateAsync();
    GitHostAccounts.provide(host, accountOf("git-other.account", "Other"))();

    expect(context.callsOf("setSettingsRows")).toEqual([
      ["git.accounts", [new SettingsRow("git.account.git-github.account", "GitHub account", "Sign in to GitHub, see who is signed in, and sign out.")]],
      ["git.accounts", [
        new SettingsRow("git.account.git-github.account", "GitHub account", "Sign in to GitHub, see who is signed in, and sign out."),
        new SettingsRow("git.account.git-azure-devops.account", "Azure DevOps account", "Sign in to Azure DevOps, see who is signed in, and sign out.")
      ]],
      ["git.accounts", [new SettingsRow("git.account.git-github.account", "GitHub account", "Sign in to GitHub, see who is signed in, and sign out.")]]
    ]);
    expect(host.calls).toEqual([]);
  });
});
