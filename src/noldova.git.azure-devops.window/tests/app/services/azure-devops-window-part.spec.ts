/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, inject, Injector, input, type InputSignal, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/desktop.protocol";
import { type CommandContribution, ContentPadding, DockSide, type DocumentContribution, NotificationHandle, type ViewContribution } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { HostAccount, HostAvatar, HostChanges, HostItem, HostPullRequest, HostPullRequestList, HostPullRequestRow, HostReference, HostSignIn, ReferenceKind, ReferenceState,
  SignInFailure, WorkItemCategory } from "@noldova/git.hosting.protocol";
import { GitBranches, GitNames, GitRemote, GitStatus, RemoteTransport } from "@noldova/git.protocol";
import { GitAvatars, GitCommitPrefixes, GitFolder, GitHostAccounts, GitHostCard, GitHostCardState, GitHostFeature, GitHostRows, GitLinkReferences, GitPullRequests,
  GitPullRequestsState, GitRepositoryLinks, type IProvidedGitHostAccount } from "@noldova/git.window";
import type { ILinkReferenceSource, LinkOpenEvent } from "@noldova/ui.components.angular";
import { MarkdownViewComponent, provideMarkdown } from "@noldova/ui.components.angular/markdown";
import { describe, expect, it, onTestFinished } from "vitest";

import manifest from "../../../../noldova.git.azure-devops/module.json" with { type: "json" };
import { AzureDevOpsHostRowComponent } from "../../../src/app/components/azure-devops-host-row/azure-devops-host-row.component.ts";
import { AzureDevOpsPullRequestComponent } from "../../../src/app/components/azure-devops-pull-request/azure-devops-pull-request.component.ts";
import { AzureDevOpsPullRequestDetailComponent }
  from "../../../src/app/components/azure-devops-pull-request-detail/azure-devops-pull-request-detail.component.ts";
import { AzureDevOpsSignInComponent } from "../../../src/app/components/azure-devops-sign-in/azure-devops-sign-in.component.ts";
import { AzureDevOpsWorkItemComponent } from "../../../src/app/components/azure-devops-work-item/azure-devops-work-item.component.ts";
import { AzureDevOpsWorkItemDetailComponent } from "../../../src/app/components/azure-devops-work-item-detail/azure-devops-work-item-detail.component.ts";
import { PullRequestChoice } from "../../../src/app/models/pull-request-choice.ts";
import { WorkItemChoice } from "../../../src/app/models/work-item-choice.ts";
import { WorkItemsPlace } from "../../../src/app/models/work-items-place.ts";
import { AzureDevOpsCommitPrefixes } from "../../../src/app/services/azure-devops-commit-prefixes.ts";
import { AzureDevOpsPullRequests } from "../../../src/app/services/azure-devops-pull-requests.ts";
import { AzureDevOpsWindowPart } from "../../../src/app/services/azure-devops-window-part.ts";
import { PullRequestSelection } from "../../../src/app/services/pull-request-selection.ts";
import { WorkItemSelection } from "../../../src/app/services/work-item-selection.ts";
import { RequestAnswers } from "../../fixtures/request-answers.fixture.ts";
import { UnhandledRejections } from "../../fixtures/unhandled-rejections.fixture.ts";
import { Wait } from "../../fixtures/wait.fixture.ts";
import { WindowFailure } from "../../fixtures/window-failure.fixture.ts";
import { detailOf, itemOf, story } from "../../fixtures/work-items-page.fixture.ts";

const signedOutNote: string = "Sign in to see pull requests, their checks and their reviewers' votes. Git works without it.";
const signedOutCards: GitHostCard[] = [new GitHostCard("Azure DevOps", signedOutNote, GitHostCardState.SignedOut, "Sign in")];
const signedInCards: GitHostCard[] = [
  new GitHostCard("Azure DevOps · monalisa@example.com", "Signed in on this computer as monalisa@example.com", GitHostCardState.SignedIn, "Signed in")
];
const otherCards: GitHostCard[] = [
  new GitHostCard("Azure DevOps · octocat@example.com", "Signed in on this computer as octocat@example.com", GitHostCardState.SignedIn, "Signed in")
];
const unreadCards: GitHostCard[] = [
  new GitHostCard("Azure DevOps", "Azure DevOps' sign-in couldn't be read; the app's log has the details.", GitHostCardState.Failed, "Sign in")
];
const waitingCards: GitHostCard[] = [
  new GitHostCard("Azure DevOps", "Finish signing in with Microsoft in the browser; this page updates once you're done.", GitHostCardState.Waiting, "Waiting for the browser")
];
const signedIn: HostSignIn = HostSignIn.signedIn(new HostAccount("monalisa@example.com", "Mona Lisa", null, []));
const otherSignedIn: HostSignIn = HostSignIn.signedIn(new HostAccount("octocat@example.com", null, null, []));

function accountOf(): IProvidedGitHostAccount | null {
  return GitHostAccounts.accounts().find(t => t.account.id === "git-azure-devops.account") ?? null;
}

function cardsOf(): readonly GitHostCard[] | null {
  return accountOf()?.account.cards() ?? null;
}

/** A commit's message as the Git view shows it: its links found through the hosts', opened by the host that claims one and by the browser otherwise. */
@Component({
  selector: "nol-git-azure-devops-message",
  imports: [MarkdownViewComponent],
  template: "<nol-markdown-view [text]=\"text()\" [references]=\"references\" (linkOpen)=\"open($event)\" />"
})
class MessageComponent {
  private readonly injector: Injector = inject(Injector);

  public readonly text: InputSignal<string> = input.required<string>();
  public readonly references: ILinkReferenceSource | null = GitLinkReferences.of("/repository");
  public readonly browsed: string[] = [];

  protected open(opened: LinkOpenEvent): void {
    if (!GitLinkReferences.opens("/repository", opened.url, this.injector))
      this.browsed.push(opened.url);
  }
}

describe("AzureDevOpsWindowPart", () => {
  it("reconnects only while it is active", async () => {
    const part: AzureDevOpsWindowPart = new AzureDevOpsWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    new RequestAnswers(context).answer(AzureDevOpsNames.readSignInMethod, HostSignIn.signedOut().toJson());

    const answers: boolean[] = [await part.reconnectAsync()];
    await part.activateAsync(context);
    answers.push(await part.reconnectAsync(), part.isActive);
    await part.deactivateAsync();
    answers.push(await part.reconnectAsync(), part.isActive);

    expect(answers).toEqual([false, true, true, false, false]);
  });

  it("deactivates before it was ever active, and a second time, without failing", async () => {
    const part: AzureDevOpsWindowPart = new AzureDevOpsWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    new RequestAnswers(context).answer(AzureDevOpsNames.readSignInMethod, HostSignIn.signedOut().toJson());

    await part.deactivateAsync();
    await part.activateAsync(context);
    await part.deactivateAsync();
    await part.deactivateAsync();

    expect([part.isActive, context.activeCallsOf("onEvent")]).toEqual([false, []]);
  });

  it("gives the Git view the commit prefix the branch dialog kept for a branch of a folder while it is active, and reads it back on the next activation",
    async () => {
      onTestFinished(() => localStorage.clear());
      const part: AzureDevOpsWindowPart = new AzureDevOpsWindowPart();
      const context: FakeWindowPartContext = new FakeWindowPartContext();
      new RequestAnswers(context).answer(AzureDevOpsNames.readSignInMethod, HostSignIn.signedOut().toJson(), HostSignIn.signedOut().toJson());
      await part.activateAsync(context);
      AzureDevOpsCommitPrefixes.keep("/repository", "users/kim/42-sign-in", 42);
      const kept = ["main", "users/kim/42-sign-in"].map(t => GitCommitPrefixes.prefixFor("/repository", t));
      const elsewhere = GitCommitPrefixes.prefixFor("/other", "users/kim/42-sign-in");
      await part.deactivateAsync();
      const withdrawn = [GitCommitPrefixes.prefixFor("/repository", "users/kim/42-sign-in"), context.activeCallsOf("onEvent").length];
      await part.activateAsync(context);
      const restored = GitCommitPrefixes.prefixFor("/repository", "users/kim/42-sign-in");
      await part.deactivateAsync();

      expect([kept, elsewhere, withdrawn, restored]).toEqual([[null, "#42 "], null, [null, 0], "#42 "]);
    });

  it("gives the Git view its row for Azure DevOps remotes while it is active, and withdraws it once", async () => {
    const part: AzureDevOpsWindowPart = new AzureDevOpsWindowPart();
    const azure: GitRemote = new GitRemote("origin", "dev.azure.com", "fabrikam/web/_git/site", RemoteTransport.Https);
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    new RequestAnswers(context).answer(AzureDevOpsNames.readSignInMethod, HostSignIn.signedOut().toJson());

    const before = GitHostRows.rowFor(azure);
    await part.activateAsync(context);
    const active = GitHostRows.rowFor(azure);
    await part.deactivateAsync();
    await part.deactivateAsync();

    expect([before, active?.row.component, active?.context, GitHostRows.rowFor(azure)]).toEqual([null, AzureDevOpsHostRowComponent, context, null]);
  });

  it("gives the repository panel its Azure DevOps pull requests while it is active, and withdraws them once", async () => {
    const part: AzureDevOpsWindowPart = new AzureDevOpsWindowPart();
    const azure: GitRemote = new GitRemote("origin", "dev.azure.com", "fabrikam/web/_git/site", RemoteTransport.Https);
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    new RequestAnswers(context).answer(AzureDevOpsNames.readSignInMethod, HostSignIn.signedOut().toJson());

    const before = GitPullRequests.of(azure);
    await part.activateAsync(context);
    const active = GitPullRequests.of(azure);
    await part.deactivateAsync();
    await part.deactivateAsync();

    expect([before, active instanceof AzureDevOpsPullRequests, GitPullRequests.of(azure)]).toEqual([null, true, null]);
  });

  it("gives the Git view its Azure DevOps link source while it is active, and withdraws it once", async () => {
    const part: AzureDevOpsWindowPart = new AzureDevOpsWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    new RequestAnswers(context).answer(AzureDevOpsNames.readSignInMethod, HostSignIn.signedOut().toJson());

    const before = GitLinkReferences.of("/repository");
    await part.activateAsync(context);
    const asked = GitLinkReferences.of("/repository");
    const found = GitLinkReferences.of("/repository")?.find("https://dev.azure.com/fabrikam/web/_workitems/edit/5", "#5") ?? null;
    await part.deactivateAsync();
    await part.deactivateAsync();

    expect([before, asked === null, found === null, found?.()?.reference, GitLinkReferences.of("/repository"), context.activeCallsOf("onEvent")])
      .toEqual([null, false, false, "Work item 5", null, []]);
  });

  it("shows a pull request the panel lists by its page's address, which names the repository, as a chip of its number", async () => {
    const part: AzureDevOpsWindowPart = new AzureDevOpsWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const requests = new RequestAnswers(context);
    const remote: GitRemote = new GitRemote("origin", "dev.azure.com", "fabrikam/web/_git/site", RemoteTransport.Https);
    const url = "https://dev.azure.com/fabrikam/web/_git/site/pullrequest/7";
    requests.answer(AzureDevOpsNames.readSignInMethod, HostSignIn.signedOut().toJson());
    requests.answer(AzureDevOpsNames.readPullRequestsMethod, new HostPullRequestList([new HostPullRequestRow(
      new HostReference("git-azure-devops", "fabrikam", "3f2504e0-4f89-11d3-9a0c-0305e82c3301", 7), "Export all notes", url, false, 0, 0, 0, 0, "export-notes", "main")],
    false).toJson());
    await part.activateAsync(context);
    onTestFinished(() => part.deactivateAsync());
    const before = GitLinkReferences.of("/repository")?.find(url, "!7") ?? null;
    const list = GitPullRequests.of(remote)?.listFor("/repository", remote);

    GitPullRequests.of(remote)?.refresh("/repository", remote);
    await Wait.until(() => {
      if (list?.()?.state !== GitPullRequestsState.Ready)
        throw new Error("The panel's list isn't read yet.");
    });

    expect([before, GitLinkReferences.of("/repository")?.find(url, "!7")?.()?.reference]).toEqual([null, "!7"]);
  });

  it("gives the Git view the Azure DevOps pictures of a dev.azure.com repository's authors while it is active, and withdraws them once", async () => {
    const part: AzureDevOpsWindowPart = new AzureDevOpsWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const picture = "data:image/png;base64,iVBORw0KGgo=";
    const answers = new RequestAnswers(context);
    answers.answer(AzureDevOpsNames.readSignInMethod, HostSignIn.signedOut().toJson());
    answers.answer(GitNames.statusMethod, new GitStatus("main", null, null, [], false, "f1", null,
      new GitRemote("origin", "dev.azure.com", "fabrikam/web/_git/site", RemoteTransport.Https)).toJson());
    answers.answer(AzureDevOpsNames.readAuthorAvatarMethod, new HostAvatar(picture).toJson());

    await part.activateAsync(context);
    const imageOf = (): string | null => GitAvatars.imageOf("/repository", "monalisa@fabrikam.com", "6dcb09b5b57875f334f61aebed695e2e4193db5e");
    const before = imageOf();
    await Wait.until(() => expect(imageOf()).toBe(picture));
    await part.deactivateAsync();
    await part.deactivateAsync();

    expect([before, imageOf()]).toEqual([null, null]);
  });

  it("claims remotes on each of Azure DevOps' hosts, and no other host's, nor a remote with no host", async () => {
    const part: AzureDevOpsWindowPart = new AzureDevOpsWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    new RequestAnswers(context).answer(AzureDevOpsNames.readSignInMethod, HostSignIn.signedOut().toJson());
    const remotes: readonly GitRemote[] = [
      new GitRemote("origin", "dev.azure.com", "fabrikam/web/_git/site", RemoteTransport.Https),
      new GitRemote("origin", "ssh.dev.azure.com", "v3/fabrikam/web/site", RemoteTransport.Ssh),
      new GitRemote("origin", "vs-ssh.visualstudio.com", "v3/fabrikam/web/site", RemoteTransport.Ssh),
      new GitRemote("origin", "fabrikam.visualstudio.com", "web/_git/site", RemoteTransport.Https),
      new GitRemote("origin", "github.com", "octocat/hello-world", RemoteTransport.Https),
      new GitRemote("origin", "visualstudio.com", "web/_git/site", RemoteTransport.Https),
      new GitRemote("origin", "dev.azure.com.example.com", "fabrikam/web/_git/site", RemoteTransport.Https),
      new GitRemote("origin", null, null, RemoteTransport.Other)
    ];

    await part.activateAsync(context);
    const claimed = remotes.map(t => GitHostRows.rowFor(t)?.row.component ?? null);
    await part.deactivateAsync();

    expect(claimed).toEqual([AzureDevOpsHostRowComponent, AzureDevOpsHostRowComponent, AzureDevOpsHostRowComponent, AzureDevOpsHostRowComponent,
      null, null, null, null]);
  });

  it("gives Accounts and hosts its Azure DevOps account while it is active, with the sign-in as its dialog and only the features it has, and withdraws it once", async () => {
    const part: AzureDevOpsWindowPart = new AzureDevOpsWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    new RequestAnswers(context).answer(AzureDevOpsNames.readSignInMethod, HostSignIn.signedOut().toJson());

    const before: IProvidedGitHostAccount | null = accountOf();
    await part.activateAsync(context);
    const provided: IProvidedGitHostAccount | null = accountOf();
    await part.deactivateAsync();
    await part.deactivateAsync();

    expect(before).toBeNull();
    expect(provided?.context).toBe(context);
    expect(provided?.account).toEqual(expect.objectContaining({ host: "Azure DevOps", column: "Azure", mark: "Az", markColor: "#0067b8", signIn: AzureDevOpsSignInComponent,
      features: [GitHostFeature.PullRequests, GitHostFeature.VotesAndPolicies, GitHostFeature.BuildsOnCommits, GitHostFeature.WorkItems,
        GitHostFeature.BranchFromItem, GitHostFeature.AutoComplete] }));
    expect([accountOf(), context.callsOf("registerSettingsPage"), context.callsOf("setSettingsRows")]).toEqual([null, [], []]);
  });

  it("registers the pull request and My work items documents, whose components are the pull request page and the work item list, without padding", async () => {
    const part: AzureDevOpsWindowPart = new AzureDevOpsWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    new RequestAnswers(context).answer(AzureDevOpsNames.readSignInMethod, HostSignIn.signedOut().toJson());
    const registered: DocumentContribution[] = [];
    context.answer("registerDocument", t => {
      registered.push(t);
    });

    await part.activateAsync(context);
    const documents = await Promise.all(registered.map(async t => [t.name, t.padding, await t.loadComponent()] as const));
    await part.deactivateAsync();

    expect(documents).toEqual([["git-azure-devops.pullRequest", ContentPadding.None, AzureDevOpsPullRequestComponent],
      ["git-azure-devops.workItems", ContentPadding.None, AzureDevOpsWorkItemComponent]]);
    expect(manifest.contributes.documents).toEqual(["git-azure-devops.pullRequest", "git-azure-devops.workItems"]);
  });

  it("registers the Work item and Pull request views, with instances and hidden at first, after the Git view in Git's group of the right dock, without padding",
    async () => {
    const part: AzureDevOpsWindowPart = new AzureDevOpsWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    new RequestAnswers(context).answer(AzureDevOpsNames.readSignInMethod, HostSignIn.signedOut().toJson());
    const registered: ViewContribution[] = [];
    context.answer("registerView", t => {
      registered.push(t);
    });

    await part.activateAsync(context);
    const views = await Promise.all(registered.map(async t => [t.name, t.title, t.defaultSide, t.isShownByDefault, t.hasInstances, t.defaultGroup, t.defaultOrder,
      t.padding, await t.loadComponent()] as const));
    await part.deactivateAsync();

    expect(views).toEqual([["git-azure-devops.workItemDetail", "Work item", DockSide.Right, false, true, 0, 40, ContentPadding.None,
      AzureDevOpsWorkItemDetailComponent], ["git-azure-devops.pullRequestDetail", "Pull request", DockSide.Right, false, true, 0, 41, ContentPadding.None,
      AzureDevOpsPullRequestDetailComponent]]);
    expect([registered.map(t => t.icon), manifest.contributes.views]).toEqual([["assignment", "merge"],
      ["git-azure-devops.workItemDetail", "git-azure-devops.pullRequestDetail"]]);
  });

  it("opens the Work item view again for the next work item chosen once the person closed it, and stops listening when it deactivates", async () => {
    const part: AzureDevOpsWindowPart = new AzureDevOpsWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    new RequestAnswers(context).answer(AzureDevOpsNames.readSignInMethod, HostSignIn.signedOut().toJson());
    await part.activateAsync(context);
    const selection = WorkItemSelection.of(context);
    const choiceOf = (id: number): WorkItemChoice => new WorkItemChoice(new WorkItemsPlace("fabrikam", "Sample Project", null),
      detailOf(itemOf(id, story, `Story ${id}`, "Active", WorkItemCategory.InProgress, null)), []);
    selection.showOnce(choiceOf(7402));
    selection.showChosen(choiceOf(7490));
    context.raiseViewClosed("git-azure-devops.workItemDetail", "selected");
    selection.showChosen(choiceOf(7521));
    const listening: number = context.activeCallsOf("onViewClosed").length;
    await part.deactivateAsync();

    expect([context.callsOf("openView").map(t => t[2]), listening, context.activeCallsOf("onViewClosed")]).toEqual([["Work item 7402", "Work item 7521"], 2, []]);
  });

  it("opens the Pull request view again for the next pull request read once the person closed it, and stops listening when it deactivates", async () => {
    const part: AzureDevOpsWindowPart = new AzureDevOpsWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    new RequestAnswers(context).answer(AzureDevOpsNames.readSignInMethod, HostSignIn.signedOut().toJson());
    await part.activateAsync(context);
    const selection = PullRequestSelection.of(context);
    const choiceOf = (number: number): PullRequestChoice => {
      const pullRequest = new HostPullRequest(new HostItem(new HostReference("git-azure-devops", "fabrikam", "site", number), ReferenceKind.PullRequest,
        ReferenceState.Open, `Change ${number}`, `https://dev.azure.com/fabrikam/web/_git/site/pullrequest/${number}`, null, 1, null, 0,
        new HostChanges(null, null, null, "export-notes", "main", "0123456789abcdef0123456789abcdef01234567")), [], [], [], false, "", null, []);
      return new PullRequestChoice(pullRequest, [], 0, { changed: () => undefined, added: () => undefined });
    };
    selection.showChosen(choiceOf(7));
    selection.showChosen(choiceOf(8));
    context.raiseViewClosed("git-azure-devops.pullRequestDetail", "selected");
    selection.showChosen(choiceOf(9));
    const listening: number = context.activeCallsOf("onViewClosed").length;
    await part.deactivateAsync();

    expect([context.callsOf("openView").map(t => t[2]), listening, context.activeCallsOf("onViewClosed")])
      .toEqual([["Pull request !7", "Pull request !9"], 2, []]);
  });

  it("registers Open my work items, which opens the project its instance names", async () => {
    const part: AzureDevOpsWindowPart = new AzureDevOpsWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    new RequestAnswers(context).answer(AzureDevOpsNames.readSignInMethod, HostSignIn.signedOut().toJson());
    const commands: CommandContribution[] = [];
    context.answer("registerCommand", t => {
      commands.push(t);
    });

    await part.activateAsync(context);
    onTestFinished(() => part.deactivateAsync());
    const ran = await Promise.all(commands.map(t => t.runAsync({ instance: "fabrikam/Sample%20Project" })));

    expect(commands.map(t => [t.name, t.title, t.icon])).toEqual([["git-azure-devops.openWorkItems", "Open my work items", "checklist"]]);
    expect(manifest.contributes.commands).toEqual(["git-azure-devops.openWorkItems"]);
    expect(ran).toEqual([null]);
    expect(context.callsOf("openDocument")).toEqual([["git-azure-devops.workItems", "fabrikam/Sample%20Project", "My work items"]]);
    for (const instance of ["fabrikam", "fabrikam/Sample%20Project/7521", "-bad/web"])
      await expect(commands[0]?.runAsync({ instance })).rejects.toMatchObject({ name: "ArgumentException", parameterName: "instance",
        message: expect.stringContaining("The command opens an Azure DevOps project named as organization/project.") });
    await expect(commands[0]?.runAsync({})).rejects.toThrow();
    expect(context.callsOf("openDocument")).toHaveLength(1);
  });

  it("opens the open repository's project with Open my work items run without arguments, each time", async () => {
    onTestFinished(GitFolder.provide(new FakeWindowPartContext(), signal("/work/site")));
    const part: AzureDevOpsWindowPart = new AzureDevOpsWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const answers = new RequestAnswers(context);
    answers.answer(AzureDevOpsNames.readSignInMethod, HostSignIn.signedOut().toJson());
    const status = new GitStatus("main", null, null, [], false, "f1", null, new GitRemote("origin", "dev.azure.com", "fabrikam/Sample%20Project/_git/site",
      RemoteTransport.Https));
    answers.answer(GitNames.statusMethod, status.toJson(), status.toJson());
    const commands: CommandContribution[] = [];
    context.answer("registerCommand", t => {
      commands.push(t);
    });

    await part.activateAsync(context);
    onTestFinished(() => part.deactivateAsync());
    const ran = [await commands[0]?.runAsync(null), await commands[0]?.runAsync(null)];

    expect(ran).toEqual([null, null]);
    expect(context.callsOf("openDocument")).toEqual([["git-azure-devops.workItems", "fabrikam/Sample%20Project", "My work items"],
      ["git-azure-devops.workItems", "fabrikam/Sample%20Project", "My work items"]]);
    expect([answers.payloads.filter((_, i) => answers.methods[i] === GitNames.statusMethod), context.callsOf("postNotificationAsync")])
      .toEqual([[{ folder: "/work/site" }, { folder: "/work/site" }], []]);
  });

  it("says in a notification that no Azure DevOps repository is open when run without arguments and no repository, another host's, or an unread status is open",
    async () => {
      const folder = signal<string | null>(null);
      onTestFinished(GitFolder.provide(new FakeWindowPartContext(), folder));
      const part: AzureDevOpsWindowPart = new AzureDevOpsWindowPart();
      const context: FakeWindowPartContext = new FakeWindowPartContext();
      const answers = new RequestAnswers(context);
      answers.answer(AzureDevOpsNames.readSignInMethod, HostSignIn.signedOut().toJson());
      answers.answer(GitNames.statusMethod, new GitStatus("main", null, null, [], false, "f1", null, new GitRemote("origin", "github.com", "octocat/hello-world",
        RemoteTransport.Https)).toJson());
      answers.fail(GitNames.statusMethod, new WindowFailure("The runtime stopped."));
      const commands: CommandContribution[] = [];
      context.answer("registerCommand", t => {
        commands.push(t);
      });
      context.answer("postNotificationAsync", async () => new NotificationHandle("n1", () => undefined));

      await part.activateAsync(context);
      onTestFinished(() => part.deactivateAsync());
      const ran = [await commands[0]?.runAsync(null)];
      folder.set("/work/site");
      ran.push(await commands[0]?.runAsync(null), await commands[0]?.runAsync(null));

      const missing = new NotificationPost(QualifiedName.parse("git-azure-devops.noProject"), "git-azure-devops.openWorkItems",
        "Open an Azure DevOps repository in Git to see your work items.", null, NotificationSeverity.Info, null, [], null);
      expect([ran, context.callsOf("openDocument"), context.callsOf("postNotificationAsync"), context.callsOf("log").map(t => t[0])]).toEqual([[null, null, null], [],
        [[missing], [missing], [missing]], ["The Azure DevOps module's git.status request failed: WindowFailure: The runtime stopped."]]);
      expect(manifest.contributes.notifications).toEqual(["git-azure-devops.noProject"]);
    });

  it("fails Open my work items run without arguments with the error a status read fails with when it isn't a window failure, opening and posting nothing", async () => {
    onTestFinished(GitFolder.provide(new FakeWindowPartContext(), signal("/work/site")));
    const part: AzureDevOpsWindowPart = new AzureDevOpsWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const answers = new RequestAnswers(context);
    answers.answer(AzureDevOpsNames.readSignInMethod, HostSignIn.signedOut().toJson());
    const error: RangeError = new RangeError("The status was out of range.");
    answers.fail(GitNames.statusMethod, error);
    const commands: CommandContribution[] = [];
    context.answer("registerCommand", t => {
      commands.push(t);
    });

    await part.activateAsync(context);
    onTestFinished(() => part.deactivateAsync());

    await expect(commands[0]?.runAsync(null)).rejects.toBe(error);
    expect([context.callsOf("openDocument"), context.callsOf("postNotificationAsync"), context.callsOf("log")]).toEqual([[], [], []]);
  });

  it("gives the repository panel a My work items row for an Azure DevOps remote while it is active, opening its project, and none for another host's", async () => {
    const part: AzureDevOpsWindowPart = new AzureDevOpsWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    new RequestAnswers(context).answer(AzureDevOpsNames.readSignInMethod, HostSignIn.signedOut().toJson());
    const azure: GitRemote = new GitRemote("origin", "dev.azure.com", "fabrikam/Sample%20Project/_git/site", RemoteTransport.Https);
    const before = GitRepositoryLinks.of(azure);

    await part.activateAsync(context);
    const links = GitRepositoryLinks.of(azure);
    for (const link of links)
      link.open();
    const other = GitRepositoryLinks.of(new GitRemote("origin", "github.com", "octocat/hello-world", RemoteTransport.Https));
    await part.deactivateAsync();

    expect([before, links.map(t => [t.key, t.label, t.icon]), other, GitRepositoryLinks.of(azure)]).toEqual([[],
      [["git-azure-devops.workItems", "My work items", "checklist"]], [], []]);
    expect(context.callsOf("openDocument")).toEqual([["git-azure-devops.workItems", "fabrikam/Sample%20Project", "My work items"]]);
  });

  it("declares each contributed name once across every kind, as the app's build requires", () => {
    const names: readonly string[] = Object.values(manifest.contributes).flat();

    expect(names.filter((t, i) => names.indexOf(t) !== i)).toEqual([]);
  });

  it("shows the signed-out card on activation, then the card of the sign-in it reads", async () => {
    const part: AzureDevOpsWindowPart = new AzureDevOpsWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const release = new RequestAnswers(context).hold(AzureDevOpsNames.readSignInMethod);

    await part.activateAsync(context);
    const first: readonly GitHostCard[] | null = cardsOf();
    release(signedIn.toJson());
    await Wait.until(() => expect(cardsOf()).toEqual(signedInCards));
    await part.deactivateAsync();

    expect(context.callsOf("requestAsync")).toEqual([[AzureDevOpsNames.readSignInMethod, null]]);
    expect(first).toEqual(signedOutCards);
  });

  it("follows the sign-in's changes with its card, the browser's wait among them, until it deactivates", async () => {
    const part: AzureDevOpsWindowPart = new AzureDevOpsWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const requests: RequestAnswers = new RequestAnswers(context);
    requests.answer(AzureDevOpsNames.readSignInMethod, HostSignIn.signedOut().toJson());

    await part.activateAsync(context);
    await Promise.allSettled(requests.answered);
    const account: IProvidedGitHostAccount | null = accountOf();
    context.raiseEvent(AzureDevOpsNames.signInChangedEvent, HostSignIn.waitingInBrowser("https://login.microsoftonline.com/example").toJson());
    const whileWaiting: readonly GitHostCard[] | null = cardsOf();
    context.raiseEvent(AzureDevOpsNames.signInChangedEvent, signedIn.toJson());
    const afterSignIn: readonly GitHostCard[] | null = cardsOf();
    context.raiseEvent(AzureDevOpsNames.signInChangedEvent, HostSignIn.signedOut(SignInFailure.Revoked).toJson());
    const afterRevoke: readonly GitHostCard[] | null = cardsOf();
    await part.deactivateAsync();
    context.raiseEvent(AzureDevOpsNames.signInChangedEvent, signedIn.toJson());

    expect([context.callsOf("onEvent").map(t => t[0]), context.activeCallsOf("onEvent")]).toEqual([[GitNames.changedEvent, AzureDevOpsNames.signInChangedEvent],
      []]);
    expect([whileWaiting, afterSignIn, afterRevoke, account?.account.cards()]).toEqual([waitingCards, signedInCards, signedOutCards, signedOutCards]);
  });

  it("drops the sign-in it read once a change arrived while the read was on its way, so the newer card stays", async () => {
    const part: AzureDevOpsWindowPart = new AzureDevOpsWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const requests: RequestAnswers = new RequestAnswers(context);
    const release = requests.hold(AzureDevOpsNames.readSignInMethod);

    await part.activateAsync(context);
    context.raiseEvent(AzureDevOpsNames.signInChangedEvent, signedIn.toJson());
    release(HostSignIn.signedOut().toJson());
    await Promise.allSettled(requests.answered);
    const cards: readonly GitHostCard[] | null = cardsOf();
    await part.deactivateAsync();

    expect(requests.answered).toHaveLength(1);
    expect(cards).toEqual(signedInCards);
  });

  it("says the sign-in couldn't be read on its card, and logs why, when the read fails", async () => {
    const part: AzureDevOpsWindowPart = new AzureDevOpsWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    new RequestAnswers(context).fail(AzureDevOpsNames.readSignInMethod, new WindowFailure("The host is gone."));

    await part.activateAsync(context);
    await Wait.until(() => expect(cardsOf()).toEqual(unreadCards));
    await part.deactivateAsync();

    expect(context.callsOf("log")).toEqual([[`The Azure DevOps module's ${AzureDevOpsNames.readSignInMethod} request failed: WindowFailure: The host is gone.`]]);
  });

  it("passes on a failure of the sign-in's read that isn't the window's, rather than showing the card of a sign-in it couldn't read", async () => {
    const part: AzureDevOpsWindowPart = new AzureDevOpsWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const unexpected = new TypeError("Unexpected.");
    new RequestAnswers(context).fail(AzureDevOpsNames.readSignInMethod, unexpected);
    const rejected = UnhandledRejections.nextAsync();

    await part.activateAsync(context);
    const error = await rejected;
    const cards: readonly GitHostCard[] | null = cardsOf();
    await part.deactivateAsync();

    expect(error).toBe(unexpected);
    expect([cards, context.callsOf("log")]).toEqual([signedOutCards, []]);
  });

  it("keeps the card of a change that arrived while a failing read was on its way", async () => {
    const part: AzureDevOpsWindowPart = new AzureDevOpsWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const reject = new RequestAnswers(context).holdFailure(AzureDevOpsNames.readSignInMethod);

    await part.activateAsync(context);
    context.raiseEvent(AzureDevOpsNames.signInChangedEvent, signedIn.toJson());
    reject(new WindowFailure("The host is gone."));
    await Wait.until(() => expect(context.callsOf("log")).toHaveLength(1));
    const cards: readonly GitHostCard[] | null = cardsOf();
    await part.deactivateAsync();

    expect(cards).toEqual(signedInCards);
  });

  it("shows no card from a read that answers after it deactivated, even once it is active again", async () => {
    const part: AzureDevOpsWindowPart = new AzureDevOpsWindowPart();
    const first: FakeWindowPartContext = new FakeWindowPartContext();
    const firstRequests: RequestAnswers = new RequestAnswers(first);
    const release = firstRequests.hold(AzureDevOpsNames.readSignInMethod);
    const second: FakeWindowPartContext = new FakeWindowPartContext();
    const reread = new RequestAnswers(second).hold(AzureDevOpsNames.readSignInMethod);

    await part.activateAsync(first);
    await part.deactivateAsync();
    await part.activateAsync(second);
    release(signedIn.toJson());
    await Promise.allSettled(firstRequests.answered);
    const afterStaleRead: readonly GitHostCard[] | null = cardsOf();
    reread(otherSignedIn.toJson());
    await Wait.until(() => expect(cardsOf()).toEqual(otherCards));
    const provider = accountOf()?.context;
    await part.deactivateAsync();

    expect([afterStaleRead, provider]).toEqual([signedOutCards, second]);
  });

  it("opens a clicked Azure DevOps work item or pull request in its page in the app, a #N in the folder remote's project, and leaves other links to the browser",
    async () => {
      const repository = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
      const part: AzureDevOpsWindowPart = new AzureDevOpsWindowPart();
      const context: FakeWindowPartContext = new FakeWindowPartContext();
      const requests = new RequestAnswers(context);
      requests.answer(AzureDevOpsNames.readSignInMethod, HostSignIn.signedOut().toJson(), HostSignIn.signedOut().toJson());
      requests.answer(GitNames.statusMethod, new GitStatus("main", "f".repeat(40), null, [], false, "f1", null,
        new GitRemote("origin", "dev.azure.com", "Fabrikam/Sample%20Project/_git/site", RemoteTransport.Https)).toJson());
      await part.activateAsync(context);
      onTestFinished(() => part.deactivateAsync());
      await Wait.until(() => {
        if ((GitLinkReferences.of("/repository")?.findText?.("#5") ?? []).length === 0)
          throw new Error("The folder's organization isn't read yet.");
      });
      TestBed.configureTestingModule({ providers: [provideMarkdown()] });
      const fixture = TestBed.createComponent(MessageComponent);
      fixture.componentRef.setInput("text", `Fixes AB#12 and #5, see https://dev.azure.com/fabrikam/web/_workitems/edit/7, [!8](https://dev.azure.com/fabrikam/web/_git/${repository}/pullrequest/8),`
        + " https://dev.azure.com/contoso/_workitems/edit/3 and https://dev.azure.com/fabrikam/web/_build/results?buildId=9.");
      fixture.autoDetectChanges();
      await fixture.whenStable();
      const links: HTMLAnchorElement[] = [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>("a.nol-markdown-link")];

      for (const link of links)
        link.click();
      const elsewhere = GitLinkReferences.opens("/elsewhere", "https://dev.azure.com/Fabrikam/_workitems/edit/12", TestBed.inject(Injector));

      expect(links.map(t => [t.matches("[nol-link-reference-chip]"), t.textContent.trim()])).toEqual([[true, "Work item 12"], [true, "Work item 5"],
        [true, "Work item 7"], [true, "!8"], [true, "Work item 3"], [false, "https://dev.azure.com/fabrikam/web/_build/results?buildId=9"]]);
      expect(context.callsOf("openDocument")).toEqual([["git-azure-devops.workItems", "Fabrikam/Sample%20Project/12", "My work items"],
        ["git-azure-devops.workItems", "Fabrikam/Sample%20Project/5", "My work items"], ["git-azure-devops.workItems", "fabrikam/web/7", "My work items"],
        ["git-azure-devops.pullRequest", `fabrikam/${repository}/8`, "!8"]]);
      expect([fixture.componentInstance.browsed, elsewhere])
        .toEqual([["https://dev.azure.com/contoso/_workitems/edit/3", "https://dev.azure.com/fabrikam/web/_build/results?buildId=9"], false]);
    });

  it("opens the branch dialog over the window for a work item card's Create a branch action, with its own context, and leaves every other link to the window",
    async () => {
      const part: AzureDevOpsWindowPart = new AzureDevOpsWindowPart();
      const context: FakeWindowPartContext = new FakeWindowPartContext();
      const requests = new RequestAnswers(context);
      requests.answer(AzureDevOpsNames.readSignInMethod, HostSignIn.signedOut().toJson());
      requests.answer(GitNames.statusMethod, new GitStatus("main", "f".repeat(40), null, [], false, "f1", null, null).toJson());
      requests.answer(GitNames.branchesMethod, new GitBranches("main", ["main"], [], [], []).toJson());
      requests.answer(AzureDevOpsNames.readSignInMethod, HostSignIn.signedOut().toJson());
      requests.answer(AzureDevOpsNames.readWorkItemMethod, null);
      const injector = TestBed.inject(Injector);
      const dialog = (): HTMLElement | null => document.querySelector("nol-git-azure-devops-branch");

      await part.activateAsync(context);
      const others = ["https://dev.azure.com/fabrikam/web/_build/results?buildId=5", "git-azure-devops:other?organization=fabrikam&id=5",
        "git-azure-devops:branch?organization=fabrikam&id=0"].map(t => GitLinkReferences.opens("/repository", t, injector));
      const shownBefore = dialog();
      const opened = GitLinkReferences.opens("/repository", "git-azure-devops:branch?organization=fabrikam&id=42&title=Sign+in+with+a+token", injector);
      const field = await Wait.until(() => {
        const input = dialog()?.querySelector("input");
        if (!(input instanceof HTMLInputElement) || input.value === "")
          throw new Error("The dialog hasn't shown its name yet.");
        return input;
      });
      const title = (document.querySelector(".nol-dialog-title")?.textContent ?? "").trim();
      dialog()?.querySelector<HTMLButtonElement>(".nol-git-azure-devops-branch-cancel")?.click();
      await Wait.until(() => {
        if (dialog() !== null)
          throw new Error("The dialog is still open.");
      });
      await part.deactivateAsync();
      const withdrawn = GitLinkReferences.opens("/repository", "git-azure-devops:branch?organization=fabrikam&id=42&title=Sign+in", injector);

      expect([others, shownBefore, opened, field.value, title, withdrawn]).toEqual([[false, false, false], null, true, "42-sign-in-with-a-token",
        "Create a branch for 42", false]);
      expect(requests.payloads.slice(1)).toEqual([{ folder: "/repository" }, { folder: "/repository" }, null,
        { host: "git-azure-devops", organization: "fabrikam", id: 42 }]);
    });
});
