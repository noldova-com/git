/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type SettingsPageContribution, SettingsRow } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { GitHubNames } from "@noldova/git.github.protocol";
import { DeviceCode, HostAccount, HostSignIn } from "@noldova/git.hosting.protocol";
import { GitRemote, RemoteTransport } from "@noldova/git.protocol";
import { GitHostRows } from "@noldova/git.window";
import { describe, expect, it } from "vitest";

import { GitHubHostRowComponent } from "../../../src/app/components/github-host-row/github-host-row.component.ts";
import { GitHubSignInComponent } from "../../../src/app/components/github-sign-in/github-sign-in.component.ts";
import { GitHubWindowPart } from "../../../src/app/services/github-window-part.ts";
import { ContextCalls } from "../../fixtures/context-calls.fixture.ts";
import { RequestAnswers } from "../../fixtures/request-answers.fixture.ts";
import { UnhandledRejections } from "../../fixtures/unhandled-rejections.fixture.ts";
import { WindowFailure } from "../../fixtures/window-failure.fixture.ts";

const signedOutNote: string = "Sign in to see pull requests, their checks, and issue and pull request links in replies. Git works without it.";
const signedOutRows: SettingsRow[] = [new SettingsRow("git-github.account", "Account", signedOutNote), new SettingsRow("git-github.signIn", "Sign in to GitHub")];
const signedInRows: SettingsRow[] = [
  new SettingsRow("git-github.account", "Account", "Signed in on this computer · access to your repositories"),
  new SettingsRow("git-github.signOut", "Sign out"),
  new SettingsRow("git-github.manageAccess", "Manage access on GitHub")
];
const unreadRows: SettingsRow[] = [
  new SettingsRow("git-github.account", "Account", "GitHub's sign-in couldn't be read; the app's log has the details."), new SettingsRow("git-github.signIn", "Sign in to GitHub")
];
const waitingRows: SettingsRow[] = [new SettingsRow("git-github.account", "Account", "Enter this code at github.com/login/device.")];
const signedIn: HostSignIn = HostSignIn.signedIn(new HostAccount("example-user", null, null, ["repo"]));
const waiting: HostSignIn = HostSignIn.waiting(new DeviceCode("WDJB-MJHT", "https://github.com/login/device", 1_800_000_000_000));

function rowsOf(context: FakeWindowPartContext): readonly unknown[] {
  return context.callsOf("setSettingsRows").map(t => t[1]);
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

  it("registers its Settings page, whose component is the GitHub sign-in", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    new RequestAnswers(context).answer(GitHubNames.readSignInMethod, HostSignIn.signedOut().toJson());
    const registered: SettingsPageContribution[] = [];
    context.answer("registerSettingsPage", t => {
      registered.push(t);
    });

    await part.activateAsync(context);
    const pages = await Promise.all(registered.map(async t => [t.name, await t.loadComponent()] as const));
    await part.deactivateAsync();

    expect(pages).toEqual([["git-github.account", GitHubSignInComponent]]);
    expect(context.callsOf("registerSettingsPage")).toEqual(registered.map(t => [t]));
  });

  it("gives the Settings search the signed-out rows on activation, then the rows of the sign-in it reads", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const calls: ContextCalls = new ContextCalls(context);
    new RequestAnswers(context).answer(GitHubNames.readSignInMethod, signedIn.toJson());

    await part.activateAsync(context);
    await calls.untilAsync("setSettingsRows", 2);
    await part.deactivateAsync();

    expect(context.callsOf("requestAsync")).toEqual([[GitHubNames.readSignInMethod, null]]);
    expect(context.callsOf("setSettingsRows")).toEqual([["git-github.account", signedOutRows], ["git-github.account", signedInRows]]);
  });

  it("follows the sign-in's changes with its rows until it deactivates", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const calls: ContextCalls = new ContextCalls(context);
    new RequestAnswers(context).answer(GitHubNames.readSignInMethod, HostSignIn.signedOut().toJson());

    await part.activateAsync(context);
    await calls.untilAsync("setSettingsRows", 2);
    context.raiseEvent(GitHubNames.signInChangedEvent, waiting.toJson());
    context.raiseEvent(GitHubNames.signInChangedEvent, signedIn.toJson());
    await part.deactivateAsync();
    context.raiseEvent(GitHubNames.signInChangedEvent, HostSignIn.signedOut().toJson());

    expect([context.callsOf("onEvent").map(t => t[0]), context.activeCallsOf("onEvent")]).toEqual([[GitHubNames.signInChangedEvent], []]);
    expect(rowsOf(context)).toEqual([signedOutRows, signedOutRows, waitingRows, signedInRows]);
  });

  it("gives its rows only for its own Settings page, each under one of the module's names, with no id twice, in every state of the sign-in", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const calls: ContextCalls = new ContextCalls(context);
    new RequestAnswers(context).fail(GitHubNames.readSignInMethod, new WindowFailure("The host is gone."));

    await part.activateAsync(context);
    await calls.untilAsync("setSettingsRows", 2);
    context.raiseEvent(GitHubNames.signInChangedEvent, waiting.toJson());
    context.raiseEvent(GitHubNames.signInChangedEvent, signedIn.toJson());
    await part.deactivateAsync();

    expect(context.callsOf("setSettingsRows")).toEqual([signedOutRows, unreadRows, waitingRows, signedInRows].map(t => ["git-github.account", t]));
    expect(context.callsOf("registerSettingsPage")).toEqual([[expect.objectContaining({ name: "git-github.account" })]]);
  });

  it("drops the sign-in it read once a change arrived while the read was on its way, so the newer rows stay", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const requests: RequestAnswers = new RequestAnswers(context);
    const release = requests.hold(GitHubNames.readSignInMethod);

    await part.activateAsync(context);
    context.raiseEvent(GitHubNames.signInChangedEvent, signedIn.toJson());
    release(HostSignIn.signedOut().toJson());
    await Promise.allSettled(requests.answered);
    await part.deactivateAsync();

    expect(requests.answered).toHaveLength(1);
    expect(rowsOf(context)).toEqual([signedOutRows, signedInRows]);
  });

  it("says the sign-in couldn't be read in its rows, and logs why, when the read fails", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const calls: ContextCalls = new ContextCalls(context);
    new RequestAnswers(context).fail(GitHubNames.readSignInMethod, new WindowFailure("The host is gone."));

    await part.activateAsync(context);
    await calls.untilAsync("setSettingsRows", 2);
    await part.deactivateAsync();

    expect(rowsOf(context)).toEqual([signedOutRows, unreadRows]);
    expect(context.callsOf("log")).toEqual([[`The GitHub module's ${GitHubNames.readSignInMethod} request failed: WindowFailure: The host is gone.`]]);
  });

  it("passes on a failure of the sign-in's read that isn't the window's, rather than showing the rows of a sign-in it couldn't read", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const unexpected = new TypeError("Unexpected.");
    new RequestAnswers(context).fail(GitHubNames.readSignInMethod, unexpected);
    const rejected = UnhandledRejections.nextAsync();

    await part.activateAsync(context);
    const error = await rejected;
    await part.deactivateAsync();

    expect(error).toBe(unexpected);
    expect([rowsOf(context), context.callsOf("log")]).toEqual([[signedOutRows], []]);
  });

  it("keeps the rows of a change that arrived while a failing read was on its way", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const calls: ContextCalls = new ContextCalls(context);
    const reject = new RequestAnswers(context).holdFailure(GitHubNames.readSignInMethod);

    await part.activateAsync(context);
    context.raiseEvent(GitHubNames.signInChangedEvent, signedIn.toJson());
    reject(new WindowFailure("The host is gone."));
    await calls.untilAsync("log", 1);
    await part.deactivateAsync();

    expect(rowsOf(context)).toEqual([signedOutRows, signedInRows]);
  });

  it("gives no rows from a read that answers after it deactivated, even once it is active again", async () => {
    const part: GitHubWindowPart = new GitHubWindowPart();
    const first: FakeWindowPartContext = new FakeWindowPartContext();
    const release = new RequestAnswers(first).hold(GitHubNames.readSignInMethod);
    const second: FakeWindowPartContext = new FakeWindowPartContext();
    const secondCalls: ContextCalls = new ContextCalls(second);
    const reread = new RequestAnswers(second).hold(GitHubNames.readSignInMethod);

    await part.activateAsync(first);
    await part.deactivateAsync();
    await part.activateAsync(second);
    release(signedIn.toJson());
    reread(waiting.toJson());
    await secondCalls.untilAsync("setSettingsRows", 2);
    await part.deactivateAsync();

    expect(rowsOf(first)).toEqual([signedOutRows]);
    expect(rowsOf(second)).toEqual([signedOutRows, waitingRows]);
  });
});
