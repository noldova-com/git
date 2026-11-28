/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { SecretFailureReason } from "@noldova/desktop.protocol";
import { FakeAppWindows, FakeModuleLog, FakeModuleSecrets } from "@noldova/desktop.runtime/testing";
import { GitHubAccessGrant, GitHubAccessRefusal } from "@noldova/git.github.protocol";
import { HostAccount, HostSignIn } from "@noldova/git.hosting.protocol";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

import { GitHubAccess } from "../../src/services/github-access.ts";
import { GitHubAvatars } from "../../src/services/github-avatars.ts";
import { GitHubDeviceFlow } from "../../src/services/github-device-flow.ts";
import { GitHubSignIn } from "../../src/services/github-sign-in.ts";
import { FakeGitHub, KeptSecrets } from "../fixtures/fake-github.fixture.ts";

const grant = { device_code: "3584d83530557fdd1f46af8289938c8ef79f9dc5", user_code: "WDJB-MJHT", verification_uri: "https://github.com/login/device", expires_in: 900, interval: 5 };
const signal: AbortSignal = new AbortController().signal;
const account: HostAccount = new HostAccount("octocat", "The Octocat", null, ["repo"]);

function signInOf(github: FakeGitHub, secrets: FakeModuleSecrets = new FakeModuleSecrets()): GitHubSignIn {
  return new GitHubSignIn(new GitHubDeviceFlow(github.fetch, new GitHubAvatars(github.fetch, new FakeModuleLog())), secrets, new FakeAppWindows(), new FakeModuleLog(), () => undefined);
}

type AccessSignIn = Pick<GitHubSignIn, "current" | "token" | "keptUnreadable">;

function accessOf(first: AccessSignIn, others: ReadonlyMap<number, AccessSignIn> = new Map(), chosen: number | null = null): GitHubAccess {
  return new GitHubAccess({
    first,
    accountForAsync: () => Promise.resolve(chosen),
    signInOf: id => id === 1 ? first : others.get(id) ?? first
  });
}

describe("GitHubAccess", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: 1_800_000_000_000 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("answers why there is no token while signed out or while a sign-in waits for its code, and the token with its login once signed in", async () => {
    const github = new FakeGitHub();
    github.answer(FakeGitHub.json(grant));
    const waiting = signInOf(github);
    const secrets = new FakeModuleSecrets();
    new KeptSecrets(secrets).values.set("git-github.signIn", JSON.stringify({ token: "gho_kept", account: account.toJson() }));
    const restored = signInOf(new FakeGitHub(), secrets);
    const before = await accessOf(waiting).accessAsync(signal);

    await waiting.startAsync();
    const whileWaiting = await accessOf(waiting).accessAsync(signal);
    await restored.restoreAsync();
    const signedIn = await accessOf(restored).accessAsync(signal);
    await restored.refusedAsync("gho_kept");
    const revoked = await accessOf(restored).accessAsync(signal);
    waiting.dispose();
    restored.dispose();

    assert.deepEqual([before, whileWaiting, signedIn, revoked], [
      new GitHubAccessRefusal("Sign in to GitHub in Settings, GitHub."),
      new GitHubAccessRefusal("The sign-in to GitHub isn't finished yet: enter its code at GitHub, or sign in again in Settings, GitHub."),
      new GitHubAccessGrant("gho_kept", "octocat"),
      new GitHubAccessRefusal("Sign in to GitHub in Settings, GitHub.")
    ]);
  });

  it("answers no token for a held token without a signed-in account", async () => {
    const answer = await accessOf({ current: HostSignIn.signedOut(), token: "gho_stale", keptUnreadable: false }).accessAsync(signal);

    assert.deepEqual(answer, new GitHubAccessRefusal("Sign in to GitHub in Settings, GitHub."));
  });

  it("answers that the kept sign-in couldn't be read when Noldova Desktop refused to read it", async () => {
    const unreadable = new FakeModuleSecrets();
    unreadable.answer("readAsync", () => Promise.reject(KeptSecrets.failure(SecretFailureReason.Unprotected)));
    const signIn = signInOf(new FakeGitHub(), unreadable);

    await signIn.restoreAsync();
    const answer = await accessOf(signIn).accessAsync(signal);
    signIn.dispose();

    assert.deepEqual(answer, new GitHubAccessRefusal("The GitHub sign-in kept on this computer couldn't be read; sign in again in Settings, GitHub."));
  });

  it("answers signed out, not unreadable, while Noldova Desktop isn't connected yet, and once connected with nothing kept or the kept token", async () => {
    const emptySecrets = new FakeModuleSecrets();
    const empty = new KeptSecrets(emptySecrets);
    empty.readFailure = KeptSecrets.failure(SecretFailureReason.NotConnected);
    const emptyWindows = new FakeAppWindows();
    const nothingKept = new GitHubSignIn(new GitHubDeviceFlow(new FakeGitHub().fetch, new GitHubAvatars(new FakeGitHub().fetch, new FakeModuleLog())), emptySecrets, emptyWindows, new FakeModuleLog(), () => undefined);
    const keptSecrets = new FakeModuleSecrets();
    const kept = new KeptSecrets(keptSecrets);
    kept.readFailure = KeptSecrets.failure(SecretFailureReason.NotConnected);
    const keptWindows = new FakeAppWindows();
    const restored = new GitHubSignIn(new GitHubDeviceFlow(new FakeGitHub().fetch, new GitHubAvatars(new FakeGitHub().fetch, new FakeModuleLog())), keptSecrets, keptWindows, new FakeModuleLog(), () => undefined);

    await nothingKept.restoreAsync();
    await restored.restoreAsync();
    const unconnected = await Promise.all([nothingKept, restored].map(t => accessOf(t).accessAsync(signal)));
    empty.readFailure = null;
    kept.readFailure = null;
    kept.values.set("git-github.signIn", JSON.stringify({ token: "gho_kept", account: account.toJson() }));
    emptyWindows.raiseChanged();
    keptWindows.raiseChanged();
    await vi.advanceTimersByTimeAsync(0);
    const connected = await Promise.all([nothingKept, restored].map(t => accessOf(t).accessAsync(signal)));
    nothingKept.dispose();
    restored.dispose();

    const signedOut = new GitHubAccessRefusal("Sign in to GitHub in Settings, GitHub.");
    assert.deepEqual(unconnected, [signedOut, signedOut]);
    assert.deepEqual(connected, [signedOut, new GitHubAccessGrant("gho_kept", "octocat")]);
  });

  it("answers no token once the sign-in stops", async () => {
    const secrets = new FakeModuleSecrets();
    new KeptSecrets(secrets).values.set("git-github.signIn", JSON.stringify({ token: "gho_kept", account: account.toJson() }));
    const signIn = signInOf(new FakeGitHub(), secrets);
    await signIn.restoreAsync();
    const before = await accessOf(signIn).accessAsync(signal);

    signIn.dispose();

    assert.deepEqual([before, signIn.token, await accessOf(signIn).accessAsync(signal)],
      [new GitHubAccessGrant("gho_kept", "octocat"), null, new GitHubAccessRefusal("Sign in to GitHub in Settings, GitHub.")]);
  });

  it("refuses an aborted call with the signal's reason, before reading the sign-in", async () => {
    const stop = new AbortController();
    const reason = new Error("The turn was cancelled.");
    stop.abort(reason);
    let reads = 0;
    const signIn = { get current(): HostSignIn {
      reads++;
      return HostSignIn.signedIn(account);
    }, token: "gho_token", keptUnreadable: false };

    await assert.rejects(accessOf(signIn).accessAsync(stop.signal), t => t === reason);
    assert.equal(reads, 0);
  });

  it("answers the account the module reads a repository with, its host, and the first account's reason when none is signed in", async () => {
    const first = { current: HostSignIn.signedOut(), token: null, keptUnreadable: true };
    const second = { current: HostSignIn.signedIn(new HostAccount("hubot", null, null, ["repo"])), token: "gho_hubot", keptUnreadable: false };
    const repository = { host: "github.com", path: "octocat/hello-world" };

    const answers = [await accessOf(first, new Map([[2, second]]), 2).accessForAsync(repository, signal), await accessOf(first).accessForAsync(repository, signal),
      await accessOf(first, new Map([[2, second]]), 2).accessAsync(signal)];

    assert.deepEqual(answers, [new GitHubAccessGrant("gho_hubot", "hubot", "github.com"),
      new GitHubAccessRefusal("The GitHub sign-in kept on this computer couldn't be read; sign in again in Settings, GitHub."),
      new GitHubAccessRefusal("The GitHub sign-in kept on this computer couldn't be read; sign in again in Settings, GitHub.")]);
  });

  it("refuses a repository on a GitHub Enterprise server, in any case, though the account chosen for it is signed in", async () => {
    const second = { current: HostSignIn.signedIn(new HostAccount("hubot", null, null, ["repo"])), token: "ghe_hubot", keptUnreadable: false };

    const answer = await accessOf(second, new Map([[2, second]]), 2).accessForAsync({ host: "GHE.example.com", path: "octocat/hello-world" }, signal);

    assert.deepEqual(answer, new GitHubAccessRefusal("The GitHub module gives other modules access to github.com only; other GitHub servers aren't served yet."));
  });

  it("refuses an aborted call for a repository with the signal's reason", async () => {
    const stop = new AbortController();
    const reason = new Error("The turn was cancelled.");
    stop.abort(reason);

    await assert.rejects(accessOf({ current: HostSignIn.signedOut(), token: null, keptUnreadable: false }).accessForAsync({ host: "github.com", path: "octocat/hello-world" },
      stop.signal), t => t === reason);
  });
});
