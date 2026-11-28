/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { GitHubNames } from "@noldova/git.github.protocol";
import { BranchPullRequest, DeviceCode, HostAccount, HostAccountEntry, HostAccountList, HostAvatar, HostChanges, HostItem, HostPullRequestList, HostPullRequestRow,
  HostReference, HostSignIn, ReferenceKind, ReferenceState, RepositoryAccount } from "@noldova/git.hosting.protocol";
import { GitRemote, GitStatus, RemoteTransport } from "@noldova/git.protocol";
import { GitAvatars, GitBranchPullRequest, GitHostAccounts, GitHostCard, GitHostCardState, GitHostFeature, GitHostRows, GitLinkReferences, GitPullRequestList,
  GitPullRequestRow, GitPullRequests, GitPullRequestState, GitPullRequestsState, type IProvidedGitHostAccount } from "@noldova/git.window";
import { describe, expect, it } from "vitest";

import { GitHubHostRowComponent } from "../../../src/app/components/github-host-row/github-host-row.component.ts";
import { GitHubAccountsComponent } from "../../../src/app/components/github-accounts/github-accounts.component.ts";
import { GitHubEnterpriseComponent } from "../../../src/app/components/github-enterprise/github-enterprise.component.ts";
import { GitHubFolders } from "../../../src/app/services/github-folders.ts";
import { GitHubPullRequests } from "../../../src/app/services/github-pull-requests.ts";
import { GitHubWindowPart } from "../../../src/app/services/github-window-part.ts";
import { RequestAnswers } from "../../fixtures/request-answers.fixture.ts";
import { UnhandledRejections } from "../../fixtures/unhandled-rejections.fixture.ts";
import { Wait } from "../../fixtures/wait.fixture.ts";
import { WindowFailure } from "../../fixtures/window-failure.fixture.ts";

const signedOutNote: string = "Sign in to see pull requests, their checks, and issue and pull request links in replies. Git works without it.";
const signedOutCards: GitHostCard[] = [new GitHostCard("GitHub", signedOutNote, GitHostCardState.SignedOut, "Sign in", "1")];
const user: HostAccount = new HostAccount("example-user", null, null, ["repo"]);
const signedInCards: GitHostCard[] = [new GitHostCard("example-user", "Signed in on this computer · access to your repositories", GitHostCardState.SignedIn, "Signed in", "1", user)];
const unreadCards: GitHostCard[] = [
  new GitHostCard("GitHub", "GitHub's sign-in couldn't be read; the app's log has the details.", GitHostCardState.Failed, "Sign in", "1")
];
const waitingCards: GitHostCard[] = [new GitHostCard("GitHub", "Enter this code at github.com/login/device.", GitHostCardState.Waiting, "Waiting for the code", "1")];
const signedIn: HostSignIn = HostSignIn.signedIn(user);
const waiting: HostSignIn = HostSignIn.waiting(new DeviceCode("WDJB-MJHT", "https://github.com/login/device", 1_800_000_000_000));

function listOf(...signIns: HostSignIn[]): JsonObject {
  return new HostAccountList(signIns.map((t, i) => new HostAccountEntry(i + 1, t))).toJson();
}

function accountOf(): IProvidedGitHostAccount | null {
  return GitHostAccounts.accounts().find(t => t.account.id === "git-github.account") ?? null;
}

function cardsOf(): readonly GitHostCard[] | null {
  return accountOf()?.account.cards() ?? null;
}

function enterpriseOf(): IProvidedGitHostAccount | null {
  return GitHostAccounts.accounts().find(t => t.account.id === "git-github.enterprise") ?? null;
}

const enterpriseNote: string = "Connect an account on a GitHub Enterprise server with a personal access token.";

describe("GitHubWindowPart", () => {
  it("reconnects only while it is active", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    new RequestAnswers(context).answer(GitHubNames.readAccountsMethod, listOf(HostSignIn.signedOut()));

    const answers: boolean[] = [await part.reconnectAsync()];
    await part.activateAsync(context);
    answers.push(await part.reconnectAsync(), part.isActive);
    await part.deactivateAsync();
    answers.push(await part.reconnectAsync(), part.isActive);

    expect(answers).toEqual([false, true, true, false, false]);
  });

  it("forgets which folders are in use when it reconnects or stops, since the main process that held their user names may be new", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const requests = new RequestAnswers(context);
    const gitHub: GitRemote = new GitRemote("origin", "github.com", "example-owner/example-repository", RemoteTransport.Https);
    requests.answer(GitHubNames.readAccountsMethod, listOf(HostSignIn.signedOut()), listOf(HostSignIn.signedOut()));
    requests.always(GitHubNames.useFolderMethod, new RepositoryAccount(null).toJson());
    const uses = (): number => requests.methods.filter(t => t === GitHubNames.useFolderMethod).length;

    await part.activateAsync(context);
    await GitHubFolders.useAsync(context, "/work/example-repository", gitHub);
    await GitHubFolders.useAsync(context, "/work/example-repository", gitHub);
    const counts: number[] = [uses()];
    await part.reconnectAsync();
    await GitHubFolders.useAsync(context, "/work/example-repository", gitHub);
    counts.push(uses());
    await part.deactivateAsync();
    await part.activateAsync(context);
    await GitHubFolders.useAsync(context, "/work/example-repository", gitHub);
    counts.push(uses());
    await part.deactivateAsync();

    expect(counts).toEqual([1, 2, 3]);
  });

  it("gives the repository panel its GitHub pull requests while it is active, and withdraws them once", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const gitHub: GitRemote = new GitRemote("origin", "github.com", "example-owner/example-repository", RemoteTransport.Https);
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    new RequestAnswers(context).answer(GitHubNames.readAccountsMethod, listOf(HostSignIn.signedOut()));

    const before = GitPullRequests.of(gitHub);
    await part.activateAsync(context);
    const active = GitPullRequests.of(gitHub);
    await part.deactivateAsync();
    await part.deactivateAsync();

    expect([before, active instanceof GitHubPullRequests, GitPullRequests.of(gitHub)]).toEqual([null, true, null]);
  });

  it("gives the Git view its row for github.com remotes while it is active, and withdraws it once", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const gitHub: GitRemote = new GitRemote("origin", "github.com", "example-owner/example-repository", RemoteTransport.Https);
    const other: GitRemote = new GitRemote("origin", "gitlab.com", "example-owner/example-repository", RemoteTransport.Ssh);

    const context: FakeWindowPartContext = new FakeWindowPartContext();
    new RequestAnswers(context).answer(GitHubNames.readAccountsMethod, listOf(HostSignIn.signedOut()));
    const before = GitHostRows.rowFor(gitHub);
    await part.activateAsync(context);
    const active = [GitHostRows.rowFor(gitHub)?.row.component, GitHostRows.rowFor(other)];
    const provider = GitHostRows.rowFor(gitHub)?.context;
    await part.deactivateAsync();
    await part.deactivateAsync();

    expect([before, ...active, GitHostRows.rowFor(gitHub)]).toEqual([null, GitHubHostRowComponent, null, null]);
    expect(provider).toBe(context);
  });

  it("gives the Git view its GitHub link source while it is active, and withdraws it once", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    new RequestAnswers(context).answer(GitHubNames.readAccountsMethod, listOf(HostSignIn.signedOut()));

    const before = GitLinkReferences.of("/repository");
    await part.activateAsync(context);
    const asked = GitLinkReferences.of("/repository");
    const found = GitLinkReferences.of("/repository")?.findText?.("See example-owner/example-repository#5.").map(t => [t.start, t.length, t.url]);
    await part.deactivateAsync();
    await part.deactivateAsync();

    expect([before, Object.isNull(asked), found, GitLinkReferences.of("/repository")])
      .toEqual([null, false, [[4, 34, "https://github.com/example-owner/example-repository/issues/5"]], null]);
  });

  it("gives the Git view the GitHub pictures of a github.com repository's authors while it is active, and withdraws them once", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const picture = "data:image/png;base64,iVBORw0KGgo=";
    const answers = new RequestAnswers(context);
    answers.answer(GitHubNames.readAccountsMethod, listOf(HostSignIn.signedOut()));
    answers.answer("git.status", new GitStatus("main", null, null, [], false, "f1", null,
      new GitRemote("origin", "github.com", "example-owner/example-repository", RemoteTransport.Https)).toJson());
    answers.answer(GitHubNames.readAuthorAvatarMethod, new HostAvatar(picture).toJson());

    await part.activateAsync(context);
    const imageOf = (): string | null => GitAvatars.imageOf("/repository", "kim@example.com", "6dcb09b5b57875f334f61aebed695e2e4193db5e");
    const before = imageOf();
    await Wait.until(() => expect(imageOf()).toBe(picture));
    await part.deactivateAsync();
    await part.deactivateAsync();

    expect([before, imageOf()]).toEqual([null, null]);
  });

  it("gives Accounts and hosts its GitHub account while it is active, with the sign-in as its dialog and only the features it has, and withdraws it once", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    new RequestAnswers(context).answer(GitHubNames.readAccountsMethod, listOf(HostSignIn.signedOut()));

    const before: IProvidedGitHostAccount | null = accountOf();
    await part.activateAsync(context);
    const provided: IProvidedGitHostAccount | null = accountOf();
    await part.deactivateAsync();
    await part.deactivateAsync();

    expect(before).toBeNull();
    expect(provided?.context).toBe(context);
    expect(provided?.account).toEqual(expect.objectContaining({ host: "GitHub", column: "GitHub", mark: "GH", markColor: "#24292f", signIn: GitHubAccountsComponent,
      features: [GitHostFeature.PullRequests, GitHostFeature.BuildsOnCommits] }));
    expect([accountOf(), context.callsOf("registerSettingsPage"), context.callsOf("setSettingsRows")]).toEqual([null, [], []]);
  });

  it("shows the first account's signed-out card on activation, then the cards of the accounts it reads", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const requests: RequestAnswers = new RequestAnswers(context);
    const release = requests.hold(GitHubNames.readAccountsMethod);

    await part.activateAsync(context);
    const first: readonly GitHostCard[] | null = cardsOf();
    release(listOf(signedIn));
    await Wait.until(() => expect(cardsOf()).toEqual(signedInCards));
    await part.deactivateAsync();

    expect(context.callsOf("requestAsync")).toEqual([[GitHubNames.readAccountsMethod, null]]);
    expect(first).toEqual(signedOutCards);
  });

  it("follows the accounts' changes with their cards until it deactivates", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const requests: RequestAnswers = new RequestAnswers(context);
    requests.answer(GitHubNames.readAccountsMethod, listOf(HostSignIn.signedOut()));

    await part.activateAsync(context);
    await Promise.allSettled(requests.answered);
    const account: IProvidedGitHostAccount | null = accountOf();
    context.raiseEvent(GitHubNames.accountsChangedEvent, listOf(waiting));
    const whileWaiting: readonly GitHostCard[] | null = cardsOf();
    context.raiseEvent(GitHubNames.accountsChangedEvent, listOf(signedIn));
    const afterSignIn: readonly GitHostCard[] | null = cardsOf();
    await part.deactivateAsync();
    context.raiseEvent(GitHubNames.accountsChangedEvent, listOf(HostSignIn.signedOut()));

    expect([context.callsOf("onEvent").map(t => t[0]), context.activeCallsOf("onEvent")]).toEqual([
      [GitHubNames.signInChangedEvent, GitHubNames.accountsChangedEvent, GitHubNames.accountsChangedEvent], []]);
    expect([whileWaiting, afterSignIn, account?.account.cards()]).toEqual([waitingCards, signedInCards, signedInCards]);
  });

  it("updates the repository panel's pull requests and the account's card together at once when someone signs in or out anywhere", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const gitHub: GitRemote = new GitRemote("origin", "github.com", "example-owner/example-repository", RemoteTransport.Https);
    const url: string = "https://github.com/example-owner/example-repository/pull/12";
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const requests: RequestAnswers = new RequestAnswers(context);
    requests.always(GitHubNames.useFolderMethod, new RepositoryAccount(null).toJson());
    requests.answer(GitHubNames.readAccountsMethod, listOf(HostSignIn.signedOut()));
    requests.answer(GitHubNames.readPullRequestsMethod, HostPullRequestList.signedOut().toJson(), new HostPullRequestList([new HostPullRequestRow(
      new HostReference("git-github", "example-owner", "example-repository", 12), "Fix the sign-in", url, false, 0, 0, 0, 0, "fix-sign-in", "main")], false).toJson(),
    HostPullRequestList.signedOut().toJson());
    await part.activateAsync(context);
    await Promise.allSettled(requests.answered);
    const pullRequests = GitPullRequests.of(gitHub);
    const list = pullRequests?.listFor("/work/site", gitHub);
    pullRequests?.refresh("/work/site", gitHub);
    const until = (state: GitPullRequestsState) => Wait.until(() => expect(list?.()?.state).toBe(state));
    await until(GitPullRequestsState.SignedOut);

    context.raiseEvent(GitHubNames.signInChangedEvent, signedIn.toJson());
    context.raiseEvent(GitHubNames.accountsChangedEvent, listOf(signedIn));
    const cardsOnSignIn: readonly GitHostCard[] | null = cardsOf();
    await until(GitPullRequestsState.Ready);
    const listOnSignIn = list?.();
    context.raiseEvent(GitHubNames.signInChangedEvent, HostSignIn.signedOut().toJson());
    context.raiseEvent(GitHubNames.accountsChangedEvent, listOf(HostSignIn.signedOut()));
    const cardsOnSignOut: readonly GitHostCard[] | null = cardsOf();
    await until(GitPullRequestsState.SignedOut);
    await part.deactivateAsync();

    expect([cardsOnSignIn, listOnSignIn, cardsOnSignOut, list?.()]).toEqual([signedInCards,
      GitPullRequestList.ready([new GitPullRequestRow("example-owner/example-repository#12", "#12", "Fix the sign-in", url, false, 0, 0, 0, 0, "fix-sign-in", "main")]),
      signedOutCards, GitPullRequestList.signedOut()]);
  });

  it("gives the commit detail the pull request that brought a github.com commit in, opened in the browser, and none once someone signs out", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const gitHub: GitRemote = new GitRemote("origin", "github.com", "example-owner/example-repository", RemoteTransport.Https);
    const url: string = "https://github.com/example-owner/example-repository/pull/12";
    const commit: string = "6dcb09b5b57875f334f61aebed695e2e4193db5e";
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const requests: RequestAnswers = new RequestAnswers(context);
    requests.always(GitHubNames.useFolderMethod, new RepositoryAccount(null).toJson());
    requests.answer(GitHubNames.readAccountsMethod, listOf(signedIn));
    requests.answer(GitHubNames.readCommitPullRequestMethod, new BranchPullRequest(new HostItem(new HostReference("git-github", "example-owner",
      "example-repository", 12), ReferenceKind.PullRequest, ReferenceState.Merged, "Fix the sign-in", url, null, 1_800_000_000_000, 1_800_000_100_000, 0,
    HostChanges.uncounted("fix-sign-in", "main", commit)), []).toJson(), new BranchPullRequest(null, []).toJson());
    await part.activateAsync(context);
    await Promise.allSettled(requests.answered);
    const pullRequests = GitPullRequests.of(gitHub);
    const answer = pullRequests?.commitFor?.("/work/site", gitHub, commit);
    await Wait.until(() => expect(answer?.()?.state).toBe(GitPullRequestsState.Ready));
    const shown = answer?.();

    context.raiseEvent(GitHubNames.signInChangedEvent, HostSignIn.signedOut().toJson());
    await Wait.until(() => expect(answer?.()?.pullRequest).toBeNull());
    await part.deactivateAsync();

    expect([shown, "open" in (pullRequests ?? {}), answer?.(), requests.methods.filter(t => t === GitHubNames.readCommitPullRequestMethod).length]).toEqual([
      GitBranchPullRequest.of(new GitPullRequestRow("example-owner/example-repository#12", "#12", "Fix the sign-in", url, false, 0, 0, 0, 0, "", "main"),
        GitPullRequestState.Merged, false), false, GitBranchPullRequest.none(0, 0, 0), 2]);
  });

  it("drops the accounts it read once a change arrived while the read was on its way, so the newer card stays", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const requests: RequestAnswers = new RequestAnswers(context);
    const release = requests.hold(GitHubNames.readAccountsMethod);

    await part.activateAsync(context);
    context.raiseEvent(GitHubNames.accountsChangedEvent, listOf(signedIn));
    release(listOf(HostSignIn.signedOut()));
    await Promise.allSettled(requests.answered);
    const cards: readonly GitHostCard[] | null = cardsOf();
    await part.deactivateAsync();

    expect(requests.answered).toHaveLength(1);
    expect(cards).toEqual(signedInCards);
  });

  it("says the accounts couldn't be read on the first account's card, and logs why, when the read fails", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    new RequestAnswers(context).fail(GitHubNames.readAccountsMethod, new WindowFailure("The host is gone."));

    await part.activateAsync(context);
    await Wait.until(() => expect(cardsOf()).toEqual(unreadCards));
    await part.deactivateAsync();

    expect(context.callsOf("log")).toEqual([[`The GitHub module's ${GitHubNames.readAccountsMethod} request failed: WindowFailure: The host is gone.`]]);
  });

  it("passes on a failure of the sign-in's read that isn't the window's, rather than showing the card of a sign-in it couldn't read", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const unexpected = new TypeError("Unexpected.");
    new RequestAnswers(context).fail(GitHubNames.readAccountsMethod, unexpected);
    const rejected = UnhandledRejections.nextAsync();

    await part.activateAsync(context);
    const error = await rejected;
    const cards: readonly GitHostCard[] | null = cardsOf();
    await part.deactivateAsync();

    expect(error).toBe(unexpected);
    expect([cards, context.callsOf("log")]).toEqual([signedOutCards, []]);
  });

  it("keeps the card of a change that arrived while a failing read was on its way", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const reject = new RequestAnswers(context).holdFailure(GitHubNames.readAccountsMethod);

    await part.activateAsync(context);
    context.raiseEvent(GitHubNames.accountsChangedEvent, listOf(signedIn));
    reject(new WindowFailure("The host is gone."));
    await Wait.until(() => expect(context.callsOf("log")).toHaveLength(1));
    const cards: readonly GitHostCard[] | null = cardsOf();
    await part.deactivateAsync();

    expect(cards).toEqual(signedInCards);
  });

  it("shows no card from a read that answers after it deactivated, even once it is active again", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const first: FakeWindowPartContext = new FakeWindowPartContext();
    const firstRequests: RequestAnswers = new RequestAnswers(first);
    const release = firstRequests.hold(GitHubNames.readAccountsMethod);
    const second: FakeWindowPartContext = new FakeWindowPartContext();
    const reread = new RequestAnswers(second).hold(GitHubNames.readAccountsMethod);

    await part.activateAsync(first);
    await part.deactivateAsync();
    await part.activateAsync(second);
    release(listOf(signedIn));
    await Promise.allSettled(firstRequests.answered);
    const afterStaleRead: readonly GitHostCard[] | null = cardsOf();
    reread(listOf(waiting));
    await Wait.until(() => expect(cardsOf()).toEqual(waitingCards));
    const provider = accountOf()?.context;
    await part.deactivateAsync();

    expect([afterStaleRead, provider]).toEqual([signedOutCards, second]);
  });

  it("shows no unread card from a read that fails after it deactivated, once it is active again", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const first: FakeWindowPartContext = new FakeWindowPartContext();
    const reject = new RequestAnswers(first).holdFailure(GitHubNames.readAccountsMethod);
    const second: FakeWindowPartContext = new FakeWindowPartContext();
    const reread = new RequestAnswers(second).hold(GitHubNames.readAccountsMethod);

    await part.activateAsync(first);
    await part.deactivateAsync();
    await part.activateAsync(second);
    reject(new WindowFailure("The host is gone."));
    await Wait.until(() => expect(first.callsOf("log")).toHaveLength(1));
    const afterStaleFailure: readonly GitHostCard[] | null = cardsOf();
    reread(listOf(signedIn));
    await Wait.until(() => expect(cardsOf()).toEqual(signedInCards));
    await part.deactivateAsync();

    expect(afterStaleFailure).toEqual(signedOutCards);
  });

  it("shows a card for each account, in the list's order, each naming its account for the dialog, titled by the account's name or else its login", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    new RequestAnswers(context).answer(GitHubNames.readAccountsMethod, listOf(signedIn, waiting, HostSignIn.signedIn(new HostAccount("example-bot", "Example Bot", null, []))));

    await part.activateAsync(context);
    await Wait.until(() => expect(cardsOf()).toHaveLength(3));
    const cards = cardsOf()?.map(t => [t.title, t.detail, t.state, t.account, t.person?.login ?? null]);
    await part.deactivateAsync();

    expect(cards).toEqual([
      ["example-user", "Signed in on this computer · access to your repositories", GitHostCardState.SignedIn, "1", "example-user"],
      ["GitHub", "Enter this code at github.com/login/device.", GitHostCardState.Waiting, "2", null],
      ["Example Bot", "example-bot · Signed in on this computer · no access to your repositories", GitHostCardState.SignedIn, "3", "example-bot"]
    ]);
  });

  it("gives Accounts and hosts one GitHub Enterprise host while it is active, with the token connect as its dialog and no features yet, and withdraws it once", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    new RequestAnswers(context).answer(GitHubNames.readAccountsMethod, listOf(HostSignIn.signedOut()));

    await part.activateAsync(context);
    const provided: IProvidedGitHostAccount | null = enterpriseOf();
    await part.deactivateAsync();
    await part.deactivateAsync();

    expect(provided?.account).toEqual(expect.objectContaining({ host: "GitHub Enterprise", column: "GitHub Enterprise", mark: "GH", markColor: "#24292f",
      signIn: GitHubEnterpriseComponent, features: [] }));
    expect([provided?.account.cards(), enterpriseOf()]).toEqual([[new GitHostCard("GitHub Enterprise", enterpriseNote, GitHostCardState.SignedOut, "Connect")], null]);
  });

  it("shows each GitHub Enterprise account as its own card under that host, naming its server, and leaves them out of GitHub's cards", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const mona: HostAccount = new HostAccount("monalisa", "Mona", null, ["repo"]);
    new RequestAnswers(context).answer(GitHubNames.readAccountsMethod, new HostAccountList([new HostAccountEntry(1, signedIn),
      new HostAccountEntry(2, HostSignIn.signedIn(mona), "ghe.example.com"),
      new HostAccountEntry(3, HostSignIn.signedIn(new HostAccount("hubot", null, null, ["repo"])), "ghe.example.com"),
      new HostAccountEntry(4, HostSignIn.signedOut(), "github.example.org")]).toJson());

    await part.activateAsync(context);
    await Wait.until(() => expect(enterpriseOf()?.account.cards()).toHaveLength(3));
    const cards = enterpriseOf()?.account.cards();
    const gitHub = cardsOf();
    await part.deactivateAsync();

    expect(cards).toEqual([new GitHostCard("Mona", "monalisa · ghe.example.com", GitHostCardState.SignedIn, "Signed in", "2", mona),
      new GitHostCard("hubot", "hubot · ghe.example.com", GitHostCardState.SignedIn, "Signed in", "3", new HostAccount("hubot", null, null, ["repo"])),
      new GitHostCard("github.example.org", enterpriseNote, GitHostCardState.SignedOut, "Connect", "4")]);
    expect(gitHub).toEqual(signedInCards);
  });
});
