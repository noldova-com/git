/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { GitHubNames } from "@noldova/git.github.protocol";
import { DeviceCode, HostAccount, HostAvatar, HostSignIn } from "@noldova/git.hosting.protocol";
import { GitRemote, GitStatus, RemoteTransport } from "@noldova/git.protocol";
import { GitAvatars, GitHostAccounts, GitHostCard, GitHostCardState, GitHostFeature, GitHostRows, GitLinkReferences, GitPullRequests,
  type IProvidedGitHostAccount } from "@noldova/git.window";
import { describe, expect, it } from "vitest";

import { GitHubHostRowComponent } from "../../../src/app/components/github-host-row/github-host-row.component.ts";
import { GitHubSignInComponent } from "../../../src/app/components/github-sign-in/github-sign-in.component.ts";
import { GitHubPullRequests } from "../../../src/app/services/github-pull-requests.ts";
import { GitHubWindowPart } from "../../../src/app/services/github-window-part.ts";
import { RequestAnswers } from "../../fixtures/request-answers.fixture.ts";
import { UnhandledRejections } from "../../fixtures/unhandled-rejections.fixture.ts";
import { Wait } from "../../fixtures/wait.fixture.ts";
import { WindowFailure } from "../../fixtures/window-failure.fixture.ts";

const signedOutNote: string = "Sign in to see pull requests, their checks, and issue and pull request links in replies. Git works without it.";
const signedOutCards: GitHostCard[] = [new GitHostCard("GitHub", signedOutNote, GitHostCardState.SignedOut, "Sign in")];
const signedInCards: GitHostCard[] = [new GitHostCard("GitHub · example-user", "Signed in on this computer · access to your repositories", GitHostCardState.SignedIn, "Signed in")];
const unreadCards: GitHostCard[] = [
  new GitHostCard("GitHub", "GitHub's sign-in couldn't be read; the app's log has the details.", GitHostCardState.Failed, "Sign in")
];
const waitingCards: GitHostCard[] = [new GitHostCard("GitHub", "Enter this code at github.com/login/device.", GitHostCardState.Waiting, "Waiting for the code")];
const signedIn: HostSignIn = HostSignIn.signedIn(new HostAccount("example-user", null, null, ["repo"]));
const waiting: HostSignIn = HostSignIn.waiting(new DeviceCode("WDJB-MJHT", "https://github.com/login/device", 1_800_000_000_000));

function accountOf(): IProvidedGitHostAccount | null {
  return GitHostAccounts.accounts().find(t => t.account.id === "git-github.account") ?? null;
}

function cardsOf(): readonly GitHostCard[] | null {
  return accountOf()?.account.cards() ?? null;
}

describe("GitHubWindowPart", () => {
  it("reconnects only while it is active", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    new RequestAnswers(context).answer(GitHubNames.readSignInMethod, HostSignIn.signedOut().toJson());

    const answers: boolean[] = [await part.reconnectAsync()];
    await part.activateAsync(context);
    answers.push(await part.reconnectAsync(), part.isActive);
    await part.deactivateAsync();
    answers.push(await part.reconnectAsync(), part.isActive);

    expect(answers).toEqual([false, true, true, false, false]);
  });

  it("gives the repository panel its GitHub pull requests while it is active, and withdraws them once", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const gitHub: GitRemote = new GitRemote("origin", "github.com", "example-owner/example-repository", RemoteTransport.Https);
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    new RequestAnswers(context).answer(GitHubNames.readSignInMethod, HostSignIn.signedOut().toJson());

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
    new RequestAnswers(context).answer(GitHubNames.readSignInMethod, HostSignIn.signedOut().toJson());
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
    new RequestAnswers(context).answer(GitHubNames.readSignInMethod, HostSignIn.signedOut().toJson());

    const before = GitLinkReferences.of("/repository");
    await part.activateAsync(context);
    const asked = GitLinkReferences.of("/repository");
    const found = GitLinkReferences.of("/repository")?.findText?.("See example-owner/example-repository#5.").map(t => [t.start, t.length, t.url]);
    await part.deactivateAsync();
    await part.deactivateAsync();

    expect([before, asked === null, found, GitLinkReferences.of("/repository")])
      .toEqual([null, false, [[4, 34, "https://github.com/example-owner/example-repository/issues/5"]], null]);
  });

  it("gives the Git view the GitHub pictures of a github.com repository's authors while it is active, and withdraws them once", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const picture = "data:image/png;base64,iVBORw0KGgo=";
    const answers = new RequestAnswers(context);
    answers.answer(GitHubNames.readSignInMethod, HostSignIn.signedOut().toJson());
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
    new RequestAnswers(context).answer(GitHubNames.readSignInMethod, HostSignIn.signedOut().toJson());

    const before: IProvidedGitHostAccount | null = accountOf();
    await part.activateAsync(context);
    const provided: IProvidedGitHostAccount | null = accountOf();
    await part.deactivateAsync();
    await part.deactivateAsync();

    expect(before).toBeNull();
    expect(provided?.context).toBe(context);
    expect(provided?.account).toEqual(expect.objectContaining({ host: "GitHub", column: "GitHub", mark: "GH", markColor: "#24292f", signIn: GitHubSignInComponent,
      features: [GitHostFeature.PullRequests, GitHostFeature.BuildsOnCommits] }));
    expect([accountOf(), context.callsOf("registerSettingsPage"), context.callsOf("setSettingsRows")]).toEqual([null, [], []]);
  });

  it("shows the signed-out card on activation, then the card of the sign-in it reads", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const requests: RequestAnswers = new RequestAnswers(context);
    const release = requests.hold(GitHubNames.readSignInMethod);

    await part.activateAsync(context);
    const first: readonly GitHostCard[] | null = cardsOf();
    release(signedIn.toJson());
    await Wait.until(() => expect(cardsOf()).toEqual(signedInCards));
    await part.deactivateAsync();

    expect(context.callsOf("requestAsync")).toEqual([[GitHubNames.readSignInMethod, null]]);
    expect(first).toEqual(signedOutCards);
  });

  it("follows the sign-in's changes with its card until it deactivates", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const requests: RequestAnswers = new RequestAnswers(context);
    requests.answer(GitHubNames.readSignInMethod, HostSignIn.signedOut().toJson());

    await part.activateAsync(context);
    await Promise.allSettled(requests.answered);
    const account: IProvidedGitHostAccount | null = accountOf();
    context.raiseEvent(GitHubNames.signInChangedEvent, waiting.toJson());
    const whileWaiting: readonly GitHostCard[] | null = cardsOf();
    context.raiseEvent(GitHubNames.signInChangedEvent, signedIn.toJson());
    const afterSignIn: readonly GitHostCard[] | null = cardsOf();
    await part.deactivateAsync();
    context.raiseEvent(GitHubNames.signInChangedEvent, HostSignIn.signedOut().toJson());

    expect([context.callsOf("onEvent").map(t => t[0]), context.activeCallsOf("onEvent")]).toEqual([[GitHubNames.signInChangedEvent], []]);
    expect([whileWaiting, afterSignIn, account?.account.cards()]).toEqual([waitingCards, signedInCards, signedInCards]);
  });

  it("drops the sign-in it read once a change arrived while the read was on its way, so the newer card stays", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const requests: RequestAnswers = new RequestAnswers(context);
    const release = requests.hold(GitHubNames.readSignInMethod);

    await part.activateAsync(context);
    context.raiseEvent(GitHubNames.signInChangedEvent, signedIn.toJson());
    release(HostSignIn.signedOut().toJson());
    await Promise.allSettled(requests.answered);
    const cards: readonly GitHostCard[] | null = cardsOf();
    await part.deactivateAsync();

    expect(requests.answered).toHaveLength(1);
    expect(cards).toEqual(signedInCards);
  });

  it("says the sign-in couldn't be read on its card, and logs why, when the read fails", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    new RequestAnswers(context).fail(GitHubNames.readSignInMethod, new WindowFailure("The host is gone."));

    await part.activateAsync(context);
    await Wait.until(() => expect(cardsOf()).toEqual(unreadCards));
    await part.deactivateAsync();

    expect(context.callsOf("log")).toEqual([[`The GitHub module's ${GitHubNames.readSignInMethod} request failed: WindowFailure: The host is gone.`]]);
  });

  it("passes on a failure of the sign-in's read that isn't the window's, rather than showing the card of a sign-in it couldn't read", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const unexpected = new TypeError("Unexpected.");
    new RequestAnswers(context).fail(GitHubNames.readSignInMethod, unexpected);
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
    const reject = new RequestAnswers(context).holdFailure(GitHubNames.readSignInMethod);

    await part.activateAsync(context);
    context.raiseEvent(GitHubNames.signInChangedEvent, signedIn.toJson());
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
    const release = firstRequests.hold(GitHubNames.readSignInMethod);
    const second: FakeWindowPartContext = new FakeWindowPartContext();
    const reread = new RequestAnswers(second).hold(GitHubNames.readSignInMethod);

    await part.activateAsync(first);
    await part.deactivateAsync();
    await part.activateAsync(second);
    release(signedIn.toJson());
    await Promise.allSettled(firstRequests.answered);
    const afterStaleRead: readonly GitHostCard[] | null = cardsOf();
    reread(waiting.toJson());
    await Wait.until(() => expect(cardsOf()).toEqual(waitingCards));
    const provider = accountOf()?.context;
    await part.deactivateAsync();

    expect([afterStaleRead, provider]).toEqual([signedOutCards, second]);
  });
});
