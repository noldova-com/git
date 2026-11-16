/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { JsonReader } from "@noldova/context.json";
import { SecretFailureReason } from "@noldova/desktop.protocol";
import { FakeAppWindows, FakeModuleLog, FakeModuleSecrets } from "@noldova/desktop.runtime/testing";
import { DeviceCode, HostAccount, HostSignIn, SignInFailure, SignInState } from "@noldova/git.hosting.protocol";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

import type { AccountRead } from "../../src/models/account-read.ts";
import type { DeviceGrant } from "../../src/models/device-grant.ts";
import type { DevicePoll } from "../../src/models/device-poll.ts";
import { GitHubAvatars } from "../../src/services/github-avatars.ts";
import { GitHubDeviceFlow } from "../../src/services/github-device-flow.ts";
import { GitHubSignIn } from "../../src/services/github-sign-in.ts";
import { FakeGitHub, KeptSecrets, linesOf } from "../fixtures/fake-github.fixture.ts";
import { MockClock } from "../fixtures/mock-clock.fixture.ts";

const START: number = 1_800_000_000_000;
const grant = { device_code: "3584d83530557fdd1f46af8289938c8ef79f9dc5", user_code: "WDJB-MJHT", verification_uri: "https://github.com/login/device", expires_in: 900, interval: 5 };
const user = { login: "octocat", name: "The Octocat", avatar_url: "https://avatars.githubusercontent.com/u/583231" };
const account: HostAccount = new HostAccount("octocat", "The Octocat", null, ["repo"]);
const png: Uint8Array<ArrayBuffer> = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
const avatar: string = `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
const picture = (): Response => new Response(new Blob([png]), { status: 200, headers: { "Content-Type": "image/png" } });
const pending = (): Response => FakeGitHub.json({ error: "authorization_pending" });
const token = (): Response => FakeGitHub.json({ access_token: "gho_token", token_type: "bearer", scope: "repo" });
const userAnswer = (): Response => FakeGitHub.json(user, 200, { "X-OAuth-Scopes": "repo" });
const bareUserAnswer = (): Response => FakeGitHub.json({ ...user, avatar_url: null }, 200, { "X-OAuth-Scopes": "repo" });

class BrokenPollFlow extends GitHubDeviceFlow {
  public override pollAsync(): Promise<DevicePoll> {
    return Promise.reject(new RangeError("Unexpected."));
  }
}

class BrokenCodeFlow extends GitHubDeviceFlow {
  public override requestCodeAsync(): Promise<DeviceGrant> {
    return Promise.reject(new RangeError("Unexpected."));
  }
}

class BrokenAccountFlow extends GitHubDeviceFlow {
  public override readAccountAsync(): Promise<AccountRead | null> {
    return Promise.reject(new RangeError("Unexpected."));
  }
}

class BrokenAvatarFlow extends GitHubDeviceFlow {
  public override withAvatarAsync(): Promise<HostAccount> {
    return Promise.reject(new RangeError("Unexpected."));
  }
}

class Rig {
  public readonly github: FakeGitHub = new FakeGitHub();
  public readonly pictures: FakeGitHub = new FakeGitHub();
  public readonly secrets: FakeModuleSecrets = new FakeModuleSecrets();
  public readonly store: KeptSecrets = new KeptSecrets(this.secrets);
  public readonly appWindows: FakeAppWindows = new FakeAppWindows();
  public readonly log: FakeModuleLog = new FakeModuleLog();
  public readonly changes: HostSignIn[] = [];
  public readonly signIn: GitHubSignIn = new GitHubSignIn(new GitHubDeviceFlow(this.github.fetch, new GitHubAvatars(this.pictures.fetch, new FakeModuleLog())), this.secrets, this.appWindows, this.log,
    t => this.change(t));
  private readonly waiters: { readonly count: number; readonly resolve: () => void }[] = [];

  public changedAsync(count: number): Promise<void> {
    return this.changes.length >= count ? Promise.resolve() : new Promise<void>(resolve => {
      this.waiters.push({ count, resolve });
    });
  }

  private change(signIn: HostSignIn): void {
    this.changes.push(signIn);
    for (const waiter of this.waiters.filter(t => t.count <= this.changes.length)) {
      this.waiters.splice(this.waiters.indexOf(waiter), 1);
      waiter.resolve();
    }
  }

  public keep(kept: string): void {
    this.store.values.set("git-github.signIn", kept);
  }

  public kept(): unknown {
    const value = this.store.values.get("git-github.signIn");
    return value === undefined ? undefined : JSON.parse(value);
  }

  public states(): readonly string[] {
    return this.changes.map(t => t.failure === null ? t.state : `${t.state} ${t.failure}`);
  }
}

async function passAsync(milliseconds: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(milliseconds);
}

describe("GitHubSignIn", () => {
  beforeEach(() => {
    MockClock.use(START);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("shows the code, polls at GitHub's interval and keeps the token with its account once the person enters the code", async () => {
    const rig = new Rig();
    rig.github.answer(FakeGitHub.json(grant), pending(), token(), userAnswer());
    rig.pictures.answer(picture());

    const started = await rig.signIn.startAsync();
    await passAsync(4_999);
    const pollsBefore = rig.github.requests.length;
    await passAsync(1);
    await passAsync(5_000);
    await rig.changedAsync(3);

    assert.deepEqual(started, HostSignIn.waiting(new DeviceCode("WDJB-MJHT", "https://github.com/login/device", START + 900_000)));
    assert.deepEqual([pollsBefore, rig.github.urls().slice(1)], [1, ["https://github.com/login/oauth/access_token", "https://github.com/login/oauth/access_token", "https://api.github.com/user"]]);
    assert.deepEqual(rig.signIn.current, HostSignIn.signedIn(new HostAccount("octocat", "The Octocat", avatar, ["repo"])));
    assert.deepEqual(rig.kept(), { token: "gho_token", account: account.toJson() });
    assert.deepEqual([rig.states(), linesOf(rig.log)], [["Waiting", "SignedIn", "SignedIn"], ["Signed in to GitHub as octocat."]]);
  });

  it("waits longer after GitHub asks it to slow down, with GitHub's interval or five seconds more", async () => {
    const rig = new Rig();
    rig.github.answer(FakeGitHub.json(grant), FakeGitHub.json({ error: "slow_down", interval: 10 }), FakeGitHub.json({ error: "slow_down" }), pending());

    await rig.signIn.startAsync();
    await passAsync(5_000);
    await passAsync(9_999);
    const afterNine = rig.github.requests.length;
    await passAsync(1);
    await passAsync(14_999);
    const afterFourteen = rig.github.requests.length;
    await passAsync(1);

    assert.deepEqual([afterNine, afterFourteen, rig.github.requests.length], [2, 3, 4]);
  });

  it("ends signed out when the code expires before the person enters it, without polling again", async () => {
    const rig = new Rig();
    rig.github.answer(FakeGitHub.json({ ...grant, expires_in: 10 }), pending());

    await rig.signIn.startAsync();
    await passAsync(10_000);

    assert.deepEqual([rig.signIn.current, rig.github.requests.length], [HostSignIn.signedOut(SignInFailure.Expired), 2]);
    assert.deepEqual([rig.states(), linesOf(rig.log)], [["Waiting", "SignedOut Expired"], ["The GitHub sign-in ended signed out: Expired."]]);
  });

  it("times the code's expiry from when GitHub answered it, so the computer's clock moving on doesn't end the sign-in early", async () => {
    const rig = new Rig();
    rig.github.answer(FakeGitHub.json(grant), pending());

    await rig.signIn.startAsync();
    vi.setSystemTime(START + 1_000_000);
    await passAsync(5_000);

    assert.deepEqual([rig.signIn.current.state, rig.github.requests.length, rig.states()], [SignInState.Waiting, 2, ["Waiting"]]);
  });

  it("ends signed out with GitHub's denial, and when GitHub can't be reached for the code", async () => {
    const denied = new Rig();
    denied.github.answer(FakeGitHub.json(grant), FakeGitHub.json({ error: "access_denied" }));
    const unreachable = new Rig();
    unreachable.github.fail(new TypeError("fetch failed"));

    await denied.signIn.startAsync();
    await passAsync(5_000);
    const answer = await unreachable.signIn.startAsync();

    assert.deepEqual([denied.signIn.current, answer], [HostSignIn.signedOut(SignInFailure.Denied), HostSignIn.signedOut(SignInFailure.Unreachable)]);
  });

  it("ends signed out when GitHub refuses the token's account or the token can't be kept, and keeps nothing", async () => {
    const refused = new Rig();
    refused.github.answer(FakeGitHub.json(grant), token(), FakeGitHub.json({ message: "Bad credentials" }, 401));
    const unkept = new Rig();
    unkept.github.answer(FakeGitHub.json(grant), token(), userAnswer());
    unkept.store.saveFailure = KeptSecrets.failure(SecretFailureReason.Unprotected);

    await refused.signIn.startAsync();
    await unkept.signIn.startAsync();
    await passAsync(5_000);

    assert.deepEqual([refused.signIn.current, unkept.signIn.current], [HostSignIn.signedOut(SignInFailure.Refused), HostSignIn.signedOut(SignInFailure.Unkept)]);
    assert.deepEqual([refused.kept(), unkept.kept()], [undefined, undefined]);
  });

  it("ends signed out with no failure, and logs the failure, when the token's save fails other than as the secrets' failure", async () => {
    const rig = new Rig();
    rig.github.answer(FakeGitHub.json(grant), token(), userAnswer());
    rig.store.saveFailure = new RangeError("Unexpected.");

    await rig.signIn.startAsync();
    await passAsync(5_000);

    assert.deepEqual([rig.signIn.current, rig.kept(), linesOf(rig.log)], [HostSignIn.signedOut(), undefined,
      ["The GitHub sign-in stopped on an unexpected failure: RangeError: Unexpected."]]);
  });

  it("ends signed out as unreachable when GitHub can't be reached for the token's account", async () => {
    const rig = new Rig();
    rig.github.answer(FakeGitHub.json(grant), token());
    rig.github.fail(new TypeError("fetch failed"));

    await rig.signIn.startAsync();
    await passAsync(5_000);

    assert.deepEqual([rig.signIn.current, rig.kept()], [HostSignIn.signedOut(SignInFailure.Unreachable), undefined]);
  });

  it("ends signed out as unreachable, and logs it, when GitHub's answer to a poll breaks off while it is read", async () => {
    const rig = new Rig();
    const broken = new ReadableStream<Uint8Array>({
      pull: controller => controller.error(new TypeError("terminated"))
    });
    rig.github.answer(FakeGitHub.json(grant), new Response(broken));

    await rig.signIn.startAsync();
    await passAsync(5_000);

    assert.deepEqual([rig.signIn.current, rig.kept()], [HostSignIn.signedOut(SignInFailure.Unreachable), undefined]);
    assert.deepEqual([rig.states(), linesOf(rig.log)], [["Waiting", "SignedOut Unreachable"], ["The GitHub sign-in ended signed out: Unreachable."]]);
  });

  it("ends signed out with no failure GitHub didn't give, and logs the failure, when a poll fails in a way it doesn't know", async () => {
    const github = new FakeGitHub();
    github.answer(FakeGitHub.json(grant));
    const log = new FakeModuleLog();
    const signIn = new GitHubSignIn(new BrokenPollFlow(github.fetch, new GitHubAvatars(github.fetch, new FakeModuleLog())), new FakeModuleSecrets(), new FakeAppWindows(), log, () => undefined);

    await signIn.startAsync();
    await passAsync(5_000);

    assert.deepEqual([signIn.current, linesOf(log)], [HostSignIn.signedOut(), ["The GitHub sign-in stopped on an unexpected failure: RangeError: Unexpected."]]);
  });

  it("passes on a start that fails in a way it doesn't know, staying signed out and ready to start again", async () => {
    const github = new FakeGitHub();
    const log = new FakeModuleLog();
    const changes: HostSignIn[] = [];
    const signIn = new GitHubSignIn(new BrokenCodeFlow(github.fetch, new GitHubAvatars(github.fetch, new FakeModuleLog())), new FakeModuleSecrets(), new FakeAppWindows(), log,
      t => void changes.push(t));

    const first: unknown = await signIn.startAsync().then(() => null, (error: unknown) => error);
    const second: unknown = await signIn.startAsync().then(() => null, (error: unknown) => error);

    assert.deepEqual([String(first), String(second), signIn.current, changes, linesOf(log)],
      ["RangeError: Unexpected.", "RangeError: Unexpected.", HostSignIn.signedOut(), [], []]);
  });

  it("starts once: a start while it waits or is signed in answers the sign-in as it is", async () => {
    const rig = new Rig();
    rig.github.answer(FakeGitHub.json(grant), token(), bareUserAnswer());

    const first = await rig.signIn.startAsync();
    const second = await rig.signIn.startAsync();
    await passAsync(5_000);
    const third = await rig.signIn.startAsync();

    assert.deepEqual([first, second, third.state], [second, second, SignInState.SignedIn]);
    assert.deepEqual([rig.github.requests.length, rig.pictures.requests.length], [3, 0]);
  });

  it("stops waiting on cancel, signed out with no failure and with no poll after it", async () => {
    const rig = new Rig();
    rig.github.answer(FakeGitHub.json(grant));

    await rig.signIn.startAsync();
    const cancelled = rig.signIn.cancel();
    await passAsync(30_000);

    assert.deepEqual([cancelled, rig.github.requests.length, rig.states()], [HostSignIn.signedOut(), 1, ["Waiting", "SignedOut"]]);
    assert.deepEqual(rig.signIn.cancel(), HostSignIn.signedOut());
  });

  it("holds the token it signed in or restored with, and signs out as Revoked only when GitHub refuses the token it holds", async () => {
    const signedIn = new Rig();
    signedIn.github.answer(FakeGitHub.json(grant), token(), bareUserAnswer());
    const restored = new Rig();
    restored.keep(JSON.stringify({ token: "gho_kept", account: account.toJson() }));
    restored.github.answer(bareUserAnswer());

    const before = signedIn.signIn.token;
    await signedIn.signIn.startAsync();
    await passAsync(5_000);
    await restored.signIn.restoreAsync();
    await passAsync(0);
    const held = [signedIn.signIn.token, restored.signIn.token];
    await restored.signIn.refusedAsync("gho_old");
    const kept = restored.signIn.current;
    await restored.signIn.refusedAsync("gho_kept");

    assert.deepEqual([before, held, kept, signedIn.pictures.requests.length + restored.pictures.requests.length], [null, ["gho_token", "gho_kept"], HostSignIn.signedIn(account), 0]);
    assert.deepEqual([restored.signIn.current, restored.signIn.token, restored.kept()], [HostSignIn.signedOut(SignInFailure.Revoked), null, undefined]);
  });

  it("refuses a second start while the first one's code hasn't come, so a cancel stops the only flow", async () => {
    const rig = new Rig();
    const release = rig.github.hold();

    const first = rig.signIn.startAsync();
    const second = await rig.signIn.startAsync();
    rig.signIn.cancel();
    release(FakeGitHub.json(grant));
    await first;
    await passAsync(30_000);

    assert.deepEqual([second, rig.signIn.current, rig.github.requests.length], [HostSignIn.signedOut(), HostSignIn.signedOut(), 1]);
    assert.deepEqual([rig.states(), rig.kept()], [["SignedOut"], undefined]);
  });

  it("stops a start whose code hasn't come yet, and stays signed out when the code comes", async () => {
    const rig = new Rig();
    const release = rig.github.hold();

    const starting = rig.signIn.startAsync();
    rig.signIn.cancel();
    release(FakeGitHub.json(grant));

    assert.deepEqual(await starting, HostSignIn.signedOut());
    assert.deepEqual(rig.states(), ["SignedOut"]);
  });

  it("drops a token that comes after the sign-in was cancelled, keeping nothing", async () => {
    const rig = new Rig();
    rig.github.answer(FakeGitHub.json(grant), token());
    const release = rig.github.hold();

    await rig.signIn.startAsync();
    await passAsync(5_000);
    rig.signIn.cancel();
    release(userAnswer());
    await passAsync(0);

    assert.deepEqual([rig.signIn.current, rig.kept()], [HostSignIn.signedOut(), undefined]);
  });

  it("forgets a token it kept after the sign-in was cancelled, and logs a token it can't forget", async () => {
    const rig = new Rig();
    rig.github.answer(FakeGitHub.json(grant), token(), userAnswer());
    const release = rig.store.holdSave();
    const stuck = new Rig();
    stuck.github.answer(FakeGitHub.json(grant), token(), userAnswer());
    const releaseStuck = stuck.store.holdSave();
    stuck.store.removeFailure = KeptSecrets.failure(SecretFailureReason.NotConnected);

    await rig.signIn.startAsync();
    await stuck.signIn.startAsync();
    await passAsync(5_000);
    rig.signIn.cancel();
    stuck.signIn.cancel();
    release();
    releaseStuck();
    await passAsync(0);

    assert.deepEqual([rig.signIn.current, rig.kept(), rig.states(), linesOf(rig.log)], [HostSignIn.signedOut(), undefined, ["Waiting", "SignedOut"], []]);
    assert.deepEqual([stuck.signIn.current, linesOf(stuck.log)], [HostSignIn.signedOut(), ["The GitHub token couldn't be removed from this computer's secrets; it is no longer used."]]);
  });

  it("keeps the token it was saving when the app quits during the save, so the next start signs in with it", async () => {
    const rig = new Rig();
    rig.github.answer(FakeGitHub.json(grant), token(), bareUserAnswer());
    const release = rig.store.holdSave();
    const saving = rig.store.savedAsync();

    await rig.signIn.startAsync();
    await passAsync(5_000);
    await saving;
    rig.signIn.dispose();
    release();
    await passAsync(0);

    assert.deepEqual([rig.kept(), rig.states()], [{ token: "gho_token", account: account.toJson() }, ["Waiting"]]);
  });

  it("leaves the token kept before when the save of a new one fails", async () => {
    const rig = new Rig();
    rig.keep(JSON.stringify({ token: "gho_old", account: account.toJson() }));
    rig.store.saveFailure = KeptSecrets.failure(SecretFailureReason.Unprotected);
    rig.github.answer(FakeGitHub.json(grant), token(), bareUserAnswer());

    await rig.signIn.startAsync();
    await passAsync(5_000);

    assert.deepEqual([rig.kept(), rig.signIn.current, rig.signIn.token], [{ token: "gho_old", account: account.toJson() }, HostSignIn.signedOut(SignInFailure.Unkept), null]);
  });

  it("stops at once, with no wait or poll left, when the sign-in is cancelled as its code arrives", async () => {
    const github = new FakeGitHub();
    github.answer(FakeGitHub.json(grant));
    const states: string[] = [];
    const signIn: GitHubSignIn = new GitHubSignIn(new GitHubDeviceFlow(github.fetch, new GitHubAvatars(new FakeGitHub().fetch, new FakeModuleLog())), new FakeModuleSecrets(),
      new FakeAppWindows(), new FakeModuleLog(), t => {
        states.push(t.state);
        if (t.state === SignInState.Waiting)
          signIn.cancel();
      });

    await signIn.startAsync();
    await passAsync(0);

    assert.deepEqual([vi.getTimerCount(), github.requests.length, states], [0, 1, ["Waiting", "SignedOut"]]);
  });

  it("keeps a newer sign-in's token when the save of a sign-in cancelled before it answers after the newer one signed in", async () => {
    const rig = new Rig();
    rig.github.answer(FakeGitHub.json(grant), token(), userAnswer(), FakeGitHub.json(grant),
      FakeGitHub.json({ access_token: "gho_newer", token_type: "bearer", scope: "repo" }), userAnswer());
    rig.pictures.answer(picture());
    const release = rig.store.holdSave();
    const firstSaved = rig.store.savedAsync();

    await rig.signIn.startAsync();
    await passAsync(5_000);
    await firstSaved;
    rig.signIn.cancel();
    await rig.signIn.startAsync();
    await passAsync(5_000);
    await rig.changedAsync(5);
    release();
    await passAsync(0);

    assert.deepEqual([rig.signIn.current.state, rig.signIn.token, rig.kept()], [SignInState.SignedIn, "gho_newer", { token: "gho_newer", account: account.toJson() }]);
    assert.deepEqual(rig.states(), ["Waiting", "SignedOut", "Waiting", "SignedIn", "SignedIn"]);
  });

  it("changes and publishes nothing once disposed while a sign-out removes the token", async () => {
    const rig = new Rig();
    rig.keep(JSON.stringify({ token: "gho_token", account: account.toJson() }));
    rig.github.hold();
    const release = rig.store.holdRemove();

    await rig.signIn.restoreAsync();
    const signingOut = rig.signIn.signOutAsync();
    rig.signIn.dispose();
    release();
    await signingOut;

    assert.deepEqual([rig.signIn.current, rig.states(), rig.kept()], [HostSignIn.signedIn(account), ["SignedIn"], undefined]);
  });

  it("shows the kept account at once without its avatar, then the account GitHub answers for its token with its avatar", async () => {
    const rig = new Rig();
    rig.keep(JSON.stringify({ token: "gho_token", account: new HostAccount("octocat", null, null, []).toJson() }));
    const release = rig.github.hold();
    rig.pictures.answer(picture());

    await rig.signIn.restoreAsync();
    const shown = rig.signIn.current;
    release(userAnswer());
    await rig.changedAsync(3);

    assert.deepEqual([shown, rig.signIn.current], [HostSignIn.signedIn(new HostAccount("octocat", null, null, [])),
      HostSignIn.signedIn(new HostAccount("octocat", "The Octocat", avatar, ["repo"]))]);
    assert.deepEqual([rig.github.requests[0]?.header("Authorization"), rig.pictures.requests[0]?.header("Authorization")], ["Bearer gho_token", null]);
  });

  it("keeps and shows a new sign-in while its avatar is still read, and shows no avatar that lands after a sign-out or after it stops", async () => {
    const rig = new Rig();
    rig.github.answer(FakeGitHub.json(grant), token(), userAnswer());
    const late = rig.pictures.hold();
    const stopped = new Rig();
    stopped.github.answer(FakeGitHub.json(grant), token(), userAnswer());
    stopped.pictures.hold();

    await Promise.all([rig.signIn.startAsync(), stopped.signIn.startAsync()]);
    await passAsync(5_000);
    await Promise.all([rig.pictures.askedAsync(1), stopped.pictures.askedAsync(1)]);
    const whileRead = [rig.signIn.current, rig.kept()];
    await rig.signIn.signOutAsync();
    const landed = new Response(png, { status: 200, headers: { "Content-Type": "image/png" } });
    late(landed);
    stopped.signIn.dispose();
    await passAsync(0);

    assert.deepEqual(whileRead, [HostSignIn.signedIn(account), { token: "gho_token", account: account.toJson() }]);
    assert.deepEqual([landed.bodyUsed, rig.states(), stopped.states()], [true, ["Waiting", "SignedIn", "SignedOut"], ["Waiting", "SignedIn"]]);
  });

  it("restores an account kept with its avatar's address, as 0.0.5 kept it, showing no address", async () => {
    const rig = new Rig();
    rig.keep(JSON.stringify({ token: "gho_token", account: { login: "octocat", name: "The Octocat", avatarUrl: user.avatar_url, scopes: ["repo"] } }));
    rig.github.hold();

    await rig.signIn.restoreAsync();
    const restored = [rig.signIn.current, rig.signIn.token];
    rig.signIn.dispose();

    assert.deepEqual(restored, [HostSignIn.signedIn(account), "gho_token"]);
    assert.ok(!JSON.stringify(rig.changes.map(t => t.toJson())).includes("avatars.githubusercontent.com"));
  });

  it("forgets a kept token GitHub no longer accepts, and keeps one GitHub can't check now", async () => {
    const revoked = new Rig();
    revoked.keep(JSON.stringify({ token: "gho_old", account: account.toJson() }));
    revoked.github.answer(FakeGitHub.json({ message: "Bad credentials" }, 401));
    const offline = new Rig();
    offline.keep(JSON.stringify({ token: "gho_token", account: account.toJson() }));
    offline.github.fail(new TypeError("fetch failed"));

    await revoked.signIn.restoreAsync();
    await offline.signIn.restoreAsync();
    await passAsync(0);

    assert.deepEqual([revoked.signIn.current, revoked.kept()], [HostSignIn.signedOut(SignInFailure.Revoked), undefined]);
    assert.deepEqual([offline.signIn.current, offline.kept()], [HostSignIn.signedIn(account), { token: "gho_token", account: account.toJson() }]);
    assert.deepEqual(linesOf(offline.log),
      ["The kept GitHub sign-in couldn't be checked now, so it stays: GitHub couldn't be reached at https://api.github.com/user for the sign-in."]);
  });

  it("logs a check of the kept token or a read of its avatar that fails in a way it doesn't know, and stays signed in", async () => {
    const kept = JSON.stringify({ token: "gho_token", account: account.toJson() });
    const github = new FakeGitHub();
    github.answer(userAnswer());
    const flows: readonly GitHubDeviceFlow[] = [new BrokenAccountFlow(github.fetch, new GitHubAvatars(github.fetch, new FakeModuleLog())),
      new BrokenAvatarFlow(github.fetch, new GitHubAvatars(github.fetch, new FakeModuleLog()))];
    const outcomes: unknown[][] = [];

    for (const flow of flows) {
      const secrets = new FakeModuleSecrets();
      new KeptSecrets(secrets).values.set("git-github.signIn", kept);
      const log = new FakeModuleLog();
      const signIn = new GitHubSignIn(flow, secrets, new FakeAppWindows(), log, () => undefined);
      await signIn.restoreAsync();
      await passAsync(0);
      outcomes.push([signIn.current.state, linesOf(log)]);
    }

    assert.deepEqual(outcomes, [[SignInState.SignedIn, ["The GitHub sign-in stopped on an unexpected failure: RangeError: Unexpected."]],
      [SignInState.SignedIn, ["The GitHub sign-in stopped on an unexpected failure: RangeError: Unexpected."]]]);
  });

  it("counts a kept value it can't read as unreadable and logs it, and no kept value as no sign-in, leaving the value alone", async () => {
    const unreadable = new Rig();
    unreadable.keep("{\"token\":\"gho_token\"}");
    const blank = new Rig();
    blank.keep(JSON.stringify({ token: "gho_token", account: { ...account.toJson(), login: " " } }));
    const none = new Rig();

    await unreadable.signIn.restoreAsync();
    await blank.signIn.restoreAsync();
    await none.signIn.restoreAsync();

    assert.deepEqual([unreadable.signIn.current, blank.signIn.current, none.signIn.current, unreadable.changes, blank.changes, none.changes],
      [HostSignIn.signedOut(), HostSignIn.signedOut(), HostSignIn.signedOut(), [], [], []]);
    assert.deepEqual([unreadable.signIn.keptUnreadable, blank.signIn.keptUnreadable, none.signIn.keptUnreadable], [true, true, false]);
    assert.deepEqual([linesOf(unreadable.log), linesOf(none.log)], [["The GitHub sign-in ended signed out: Unkept."], []]);
    assert.deepEqual([unreadable.kept(), unreadable.github.requests.length], [{ token: "gho_token" }, 0]);
  });

  it("rethrows an error other than malformed JSON while it reads the kept sign-in, and doesn't mark the kept sign-in unreadable", async () => {
    const rig = new Rig();
    rig.keep(JSON.stringify({ token: "gho_token", account: account.toJson() }));
    const unexpected = new RangeError("Unexpected.");
    vi.spyOn(JsonReader, "parseValue").mockImplementation(() => {
      throw unexpected;
    });

    const error: unknown = await rig.signIn.restoreAsync().then(() => null, (t: unknown) => t);

    assert.deepEqual([error, rig.signIn.keptUnreadable, rig.changes], [unexpected, false, []]);
  });

  it("reads the kept sign-in again once the app's main process connects, and only once", async () => {
    const rig = new Rig();
    rig.keep(JSON.stringify({ token: "gho_token", account: account.toJson() }));
    rig.store.readFailure = KeptSecrets.failure(SecretFailureReason.NotConnected);
    rig.github.answer(bareUserAnswer());

    await rig.signIn.restoreAsync();
    await rig.signIn.restoreAsync();
    const waitingListeners = rig.appWindows.activeCallsOf("onChanged").length;
    rig.store.readFailure = null;
    rig.appWindows.raiseChanged();
    await passAsync(0);

    assert.deepEqual([waitingListeners, rig.appWindows.activeCallsOf("onChanged").length, rig.signIn.current, rig.pictures.requests.length], [1, 0, HostSignIn.signedIn(account), 0]);
  });

  it("logs a kept sign-in the secrets can't read for another reason, with the secrets' failure, and stays signed out", async () => {
    const rig = new Rig();
    rig.store.readFailure = KeptSecrets.failure(SecretFailureReason.Undecryptable);

    await rig.signIn.restoreAsync();

    assert.deepEqual([rig.signIn.current, rig.signIn.keptUnreadable, rig.appWindows.activeCallsOf("onChanged").length, linesOf(rig.log)],
      [HostSignIn.signedOut(), true, 0, ["The kept GitHub sign-in couldn't be read from this computer's secrets: The secret call failed."]]);
  });

  it("passes on a read of the kept sign-in that fails other than as the secrets' failure, counting nothing as unreadable", async () => {
    const rig = new Rig();
    const unexpected = new RangeError("Unexpected.");
    rig.store.readFailure = unexpected;

    const error: unknown = await rig.signIn.restoreAsync().then(() => null, (t: unknown) => t);

    assert.deepEqual([error, rig.signIn.current, rig.signIn.keptUnreadable, rig.changes, linesOf(rig.log)], [unexpected, HostSignIn.signedOut(), false, [], []]);
  });

  it("does nothing with a kept sign-in whose read ends after it was disposed", async () => {
    const kept = new Rig();
    kept.keep(JSON.stringify({ token: "gho_token", account: account.toJson() }));
    const releaseKept = kept.store.holdRead();
    const waiting = new Rig();
    waiting.store.readFailure = KeptSecrets.failure(SecretFailureReason.NotConnected);
    const releaseWaiting = waiting.store.holdRead();

    const restoring = [kept.signIn.restoreAsync(), waiting.signIn.restoreAsync()];
    kept.signIn.dispose();
    waiting.signIn.dispose();
    releaseKept();
    releaseWaiting();
    await Promise.all(restoring);

    assert.deepEqual([kept.signIn.current, kept.changes, kept.github.requests.length], [HostSignIn.signedOut(), [], 0]);
    assert.deepEqual([waiting.appWindows.activeCallsOf("onChanged").length, linesOf(waiting.log)], [0, []]);
  });

  it("doesn't show a kept account once a sign-in has started", async () => {
    const rig = new Rig();
    rig.keep(JSON.stringify({ token: "gho_token", account: account.toJson() }));
    rig.github.answer(FakeGitHub.json(grant));

    await rig.signIn.startAsync();
    await rig.signIn.restoreAsync();

    assert.equal(rig.signIn.current.state, SignInState.Waiting);
  });

  it("drops GitHub's answer for a kept token once the person signed out and in again, whether it refuses or accepts the old token", async () => {
    const accounts: unknown[][] = [];
    for (const answer of [FakeGitHub.json({ message: "Bad credentials" }, 401), FakeGitHub.json({ ...user, login: "hubot" }, 200, { "X-OAuth-Scopes": "repo" })]) {
      const rig = new Rig();
      rig.keep(JSON.stringify({ token: "gho_old", account: new HostAccount("hubot", null, null, ["repo"]).toJson() }));
      const release = rig.github.hold();
      rig.github.answer(FakeGitHub.json(grant), token(), bareUserAnswer());

      await rig.signIn.restoreAsync();
      await rig.signIn.signOutAsync();
      await rig.signIn.startAsync();
      await passAsync(5_000);
      release(answer);
      await passAsync(0);
      accounts.push([rig.signIn.current, rig.kept(), rig.pictures.requests.length]);
    }

    assert.deepEqual(accounts, [
      [HostSignIn.signedIn(account), { token: "gho_token", account: account.toJson() }, 0],
      [HostSignIn.signedIn(account), { token: "gho_token", account: account.toJson() }, 0]
    ]);
  });

  it("drops GitHub's answer for a kept token once the person signed out", async () => {
    const rig = new Rig();
    rig.keep(JSON.stringify({ token: "gho_token", account: account.toJson() }));
    const release = rig.github.hold();

    await rig.signIn.restoreAsync();
    await rig.signIn.signOutAsync();
    release(FakeGitHub.json({ message: "Bad credentials" }, 401));
    await passAsync(0);

    assert.deepEqual([rig.signIn.current, rig.states()], [HostSignIn.signedOut(), ["SignedIn", "SignedOut"]]);
  });

  it("forgets the token on sign-out, and still signs out when the secrets can't remove it, saying so", async () => {
    const rig = new Rig();
    rig.keep(JSON.stringify({ token: "gho_token", account: account.toJson() }));
    rig.github.answer(userAnswer());
    rig.pictures.answer(picture());
    const stuck = new Rig();
    stuck.keep(JSON.stringify({ token: "gho_token", account: account.toJson() }));
    stuck.github.answer(userAnswer());
    stuck.pictures.answer(picture());
    stuck.store.removeFailure = KeptSecrets.failure(SecretFailureReason.NotConnected);

    await rig.signIn.restoreAsync();
    await stuck.signIn.restoreAsync();
    await passAsync(0);
    const answers = [await rig.signIn.signOutAsync(), await stuck.signIn.signOutAsync(), await rig.signIn.signOutAsync()];

    assert.deepEqual(answers, [HostSignIn.signedOut(), HostSignIn.signedOut(SignInFailure.Unforgotten), HostSignIn.signedOut()]);
    assert.deepEqual([rig.kept(), linesOf(stuck.log)], [undefined, ["The GitHub token couldn't be removed from this computer's secrets; it is no longer used."]]);
  });

  it("signs out as Unforgotten and passes on a removal of the token that fails other than as the secrets' failure", async () => {
    const rig = new Rig();
    rig.keep(JSON.stringify({ token: "gho_token", account: account.toJson() }));
    rig.github.answer(userAnswer());
    rig.pictures.answer(picture());
    const unexpected = new RangeError("Unexpected.");
    rig.store.removeFailure = unexpected;

    await rig.signIn.restoreAsync();
    await passAsync(0);
    const error: unknown = await rig.signIn.signOutAsync().then(() => null, (t: unknown) => t);

    assert.deepEqual([error, rig.signIn.current, rig.signIn.token, linesOf(rig.log)], [unexpected, HostSignIn.signedOut(SignInFailure.Unforgotten), null, []]);
  });

  it("signs out of a sign-in that waits, without touching the secrets", async () => {
    const rig = new Rig();
    rig.github.answer(FakeGitHub.json(grant));
    rig.store.removeFailure = KeptSecrets.failure(SecretFailureReason.NotConnected);

    await rig.signIn.startAsync();
    const answer = await rig.signIn.signOutAsync();

    assert.deepEqual([answer, linesOf(rig.log), rig.secrets.calls], [HostSignIn.signedOut(), [], []]);
  });

  it("stops everything once disposed: no poll, no start, no read of the kept sign-in", async () => {
    const rig = new Rig();
    rig.github.answer(FakeGitHub.json(grant));
    const waiting = new Rig();
    waiting.store.readFailure = KeptSecrets.failure(SecretFailureReason.NotConnected);
    const kept = new Rig();
    kept.keep(JSON.stringify({ token: "gho_token", account: account.toJson() }));

    await rig.signIn.startAsync();
    rig.signIn.dispose();
    await passAsync(30_000);
    await waiting.signIn.restoreAsync();
    waiting.signIn.dispose();
    waiting.signIn.dispose();
    await waiting.signIn.restoreAsync();
    kept.signIn.dispose();
    await kept.signIn.restoreAsync();

    const signedOut = new Rig();
    signedOut.signIn.dispose();

    assert.deepEqual([rig.github.requests.length, (await rig.signIn.startAsync()).state], [1, SignInState.Waiting]);
    assert.deepEqual([await signedOut.signIn.startAsync(), signedOut.github.requests.length], [HostSignIn.signedOut(), 0]);
    assert.deepEqual([waiting.appWindows.activeCallsOf("onChanged").length, linesOf(waiting.log), kept.signIn.current, kept.github.requests.length], [0, [], HostSignIn.signedOut(), 0]);
  });
});
