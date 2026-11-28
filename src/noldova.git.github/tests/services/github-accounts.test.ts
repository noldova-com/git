/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { JsonReader } from "@noldova/context.json";
import { FailureCode, SecretFailureReason } from "@noldova/desktop.protocol";
import { MethodFailureException } from "@noldova/desktop.runtime";
import { FakeAppWindows, FakeModuleLog, FakeModuleSecrets } from "@noldova/desktop.runtime/testing";
import { AccountPick, HostAccount, HostSignIn, SignInFailure, SignInState } from "@noldova/git.hosting.protocol";
import { afterEach, describe, it, vi } from "vitest";

import { GitHubAccounts } from "../../src/services/github-accounts.ts";
import { GitHubApi } from "../../src/services/github-api.ts";
import { GitHubAvatars } from "../../src/services/github-avatars.ts";
import { GitHubDeviceFlow } from "../../src/services/github-device-flow.ts";
import { FakeGitHub, KeptSecrets, linesOf } from "../fixtures/fake-github.fixture.ts";
import { MockClock } from "../fixtures/mock-clock.fixture.ts";

const REPOSITORY: string = "octocat/hello-world";
const grant = { device_code: "3584d83530557fdd1f46af8289938c8ef79f9dc5", user_code: "WDJB-MJHT", verification_uri: "https://github.com/login/device", expires_in: 900, interval: 5 };
const accountOf = (login: string): HostAccount => new HostAccount(login, null, null, ["repo"]);
const keptOf = (login: string): string => JSON.stringify({ token: `gho_${login}`, account: accountOf(login).toJson() });
const userOf = (login: string): Response => FakeGitHub.json({ login, name: null, avatar_url: null }, 200, { "X-OAuth-Scopes": "repo" });
const repository = (): Response => FakeGitHub.json({ full_name: REPOSITORY });
const missing = (): Response => FakeGitHub.json({ message: "Not Found" }, 404);

class Rig {
  public readonly github: FakeGitHub = new FakeGitHub();
  public readonly secrets: FakeModuleSecrets = new FakeModuleSecrets();
  public readonly store: KeptSecrets = new KeptSecrets(this.secrets);
  public readonly appWindows: FakeAppWindows = new FakeAppWindows();
  public readonly log: FakeModuleLog = new FakeModuleLog();
  public readonly changes: string[] = [];
  public readonly accounts: GitHubAccounts = new GitHubAccounts(new GitHubDeviceFlow(this.github.fetch, new GitHubAvatars(this.github.fetch, new FakeModuleLog())),
    this.secrets, this.appWindows, this.log, new GitHubApi(this.github.fetch), (id, t) => this.change(id, t));
  private readonly waiters: { readonly count: number; readonly resolve: () => void }[] = [];

  public keep(logins: readonly string[], picks: readonly AccountPick[] = []): void {
    logins.forEach((login, index) => this.store.values.set(index === 0 ? "git-github.signIn" : `git-github.account${index + 1}`, keptOf(login)));
    this.store.values.set("git-github.accounts", JSON.stringify({ accounts: logins.slice(1).map((login, index) => ({ id: index + 2, host: "github.com", login })),
      picks: picks.map(t => t.toJson()) }));
  }

  public async restoreAsync(logins: readonly string[]): Promise<void> {
    this.github.answer(...logins.map(userOf));
    await this.accounts.restoreAsync();
    await this.github.askedAsync(logins.length);
    await this.changedAsync(logins.length * 2);
    this.github.requests.length = 0;
  }

  public changedAsync(count: number): Promise<void> {
    return this.changes.length >= count ? Promise.resolve() : new Promise<void>(resolve => {
      this.waiters.push({ count, resolve });
    });
  }

  public untilAsync(change: string): Promise<void> {
    return this.changes.includes(change) ? Promise.resolve() : this.changedAsync(this.changes.length + 1).then(() => this.untilAsync(change));
  }

  public index(): unknown {
    const value = this.store.values.get("git-github.accounts");
    return value === undefined ? undefined : JSON.parse(value);
  }

  public async savedAsync(): Promise<void> {
    await new Promise<void>(resolve => {
      setImmediate(resolve);
    });
  }

  public logins(): readonly (string | null)[] {
    return this.accounts.list.accounts.map(t => t.signIn.account?.login ?? null);
  }

  private change(id: number, signIn: HostSignIn): void {
    this.changes.push(`${id} ${signIn.state}`);
    for (const waiter of this.waiters.filter(t => t.count <= this.changes.length)) {
      this.waiters.splice(this.waiters.indexOf(waiter), 1);
      waiter.resolve();
    }
  }
}

describe("GitHubAccounts", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("passes on a read of the index, or a reading of it, that fails other than as the secrets' or the JSON's failure", async () => {
    const unexpected = new RangeError("Unexpected.");
    const refused = new Rig();
    refused.store.readFailure = unexpected;
    const readFailure: unknown = await refused.accounts.restoreAsync().then(() => null, (t: unknown) => t);
    const broken = new Rig();
    broken.keep(["octocat", "hubot"]);
    vi.spyOn(JsonReader, "parseValue").mockImplementationOnce(() => {
      throw unexpected;
    });
    const parseFailure: unknown = await broken.accounts.restoreAsync().then(() => null, (t: unknown) => t);

    assert.deepEqual([readFailure, parseFailure, refused.changes, broken.changes, linesOf(refused.log)], [unexpected, unexpected, [], [], []]);
  });

  it("restores the first account once and each other account once, whatever the index repeats", async () => {
    const rig = new Rig();
    rig.keep(["octocat", "hubot"]);
    rig.store.values.set("git-github.accounts", JSON.stringify({ accounts: [1, 2, 2].map(id => ({ id, host: "github.com", login: "hubot" })), picks: [] }));

    await rig.restoreAsync(["octocat", "hubot"]);

    assert.deepEqual([rig.accounts.list.accounts.map(t => t.id), rig.logins()], [[1, 2], ["octocat", "hubot"]]);
  });

  it("logs a restore that fails unexpectedly once a window connects", async () => {
    const rig = new Rig();
    rig.store.readFailure = KeptSecrets.failure(SecretFailureReason.NotConnected);
    await rig.accounts.restoreAsync();

    rig.store.readFailure = new RangeError("Unexpected.");
    rig.appWindows.raiseChanged();
    await rig.savedAsync();

    assert.ok(linesOf(rig.log).includes("The GitHub sign-in stopped on an unexpected failure: RangeError: Unexpected."));
  });

  it("does nothing with an index whose read ends after it was disposed", async () => {
    const rig = new Rig();
    rig.keep(["octocat", "hubot"]);
    const release = rig.store.holdRead();

    const restoring = rig.accounts.restoreAsync();
    rig.accounts.dispose();
    release();
    await restoring;

    assert.deepEqual([rig.accounts.list.accounts.map(t => t.id), rig.changes, rig.github.requests.length], [[1], [], 0]);
  });

  it("restores a sign-in an earlier version kept as the first account, and writes no index while it is the only one", async () => {
    const rig = new Rig();
    rig.store.values.set("git-github.signIn", keptOf("octocat"));

    await rig.restoreAsync(["octocat"]);
    await rig.savedAsync();

    assert.deepEqual([rig.logins(), rig.accounts.list.accounts.map(t => t.id), rig.index()], [["octocat"], [1], undefined]);
    assert.deepEqual(rig.accounts.signedIn.map(t => [t.id, t.login, t.token]), [[1, "octocat", "gho_octocat"]]);
  });

  it("restores every account the index names, each from its own secret, the first first", async () => {
    const rig = new Rig();
    rig.keep(["octocat", "hubot", "monalisa"]);

    await rig.restoreAsync(["octocat", "hubot", "monalisa"]);

    assert.deepEqual([rig.logins(), rig.accounts.list.accounts.map(t => t.id)], [["octocat", "hubot", "monalisa"], [1, 2, 3]]);
    assert.deepEqual(rig.github.requests.length, 0);
  });

  it("drops an account the index names whose own secret is gone, and writes the index without it", async () => {
    const rig = new Rig();
    rig.keep(["octocat", "hubot"]);
    rig.store.values.delete("git-github.account2");

    await rig.restoreAsync(["octocat"]);
    await rig.savedAsync();

    assert.deepEqual([rig.logins(), rig.index()], [["octocat"], { accounts: [], picks: [] }]);
  });

  it("restores only the first account when the index can't be read, and says so", async () => {
    const rig = new Rig();
    rig.keep(["octocat", "hubot"]);
    rig.store.values.set("git-github.accounts", "{ not json");

    await rig.restoreAsync(["octocat"]);

    assert.deepEqual([rig.logins(), linesOf(rig.log)], [["octocat"],
      ["The GitHub accounts kept on this computer couldn't be read; only the first account was restored."]]);
  });

  it("says why when the secrets refuse the index, and restores it once a window connects when they weren't connected yet", async () => {
    const refused = new Rig();
    refused.store.readFailure = KeptSecrets.failure(SecretFailureReason.Unprotected);
    await refused.accounts.restoreAsync();

    const waiting = new Rig();
    waiting.keep(["octocat", "hubot"]);
    waiting.store.readFailure = KeptSecrets.failure(SecretFailureReason.NotConnected);
    await waiting.accounts.restoreAsync();
    const before = [waiting.logins(), waiting.appWindows.activeCallsOf("onChanged").length];
    waiting.store.readFailure = null;
    waiting.github.answer(userOf("octocat"), userOf("hubot"));
    waiting.appWindows.raiseChanged();
    await waiting.changedAsync(4);

    assert.deepEqual(linesOf(refused.log)[0], "The GitHub accounts kept on this computer couldn't be read: The secret call failed.");
    assert.deepEqual([before, waiting.logins(), waiting.appWindows.activeCallsOf("onChanged").length], [[[null], 2], ["octocat", "hubot"], 0]);
  });

  it("adds an account whose sign-in waits under the next id, and lets it leave when the person cancels it", async () => {
    const rig = new Rig();
    await rig.accounts.restoreAsync();
    rig.github.answer(FakeGitHub.json(grant));

    const added = await rig.accounts.addAsync();
    const whileWaiting = rig.accounts.list.accounts.map(t => [t.id, t.signIn.state]);
    rig.accounts.signInOf(2).cancel();
    await rig.savedAsync();

    assert.deepEqual([added.id, added.signIn.state, whileWaiting], [2, SignInState.Waiting, [[1, SignInState.SignedOut], [2, SignInState.Waiting]]]);
    assert.deepEqual([rig.accounts.list.accounts.map(t => t.id), rig.changes, rig.index()], [[1], ["2 Waiting", "2 SignedOut"], undefined]);
  });

  it("keeps an account added while a restore waits, its sign-in still running once the restore ends", async () => {
    const rig = new Rig();
    rig.keep(["octocat"]);
    const restored = rig.github.hold();
    const restoring = rig.accounts.restoreAsync();
    await rig.github.askedAsync(1);
    const granted = rig.github.hold();

    const adding = rig.accounts.addAsync();
    await rig.github.askedAsync(2);
    restored(userOf("octocat"));
    await restoring;
    granted(FakeGitHub.json(grant));
    const added = await adding;

    assert.deepEqual([added.id, added.signIn.state, rig.accounts.list.accounts.map(t => [t.id, t.signIn.state])],
      [2, SignInState.Waiting, [[1, SignInState.SignedIn], [2, SignInState.Waiting]]]);
  });

  it("gives an account added while the restore reads the index an id the index doesn't name", async () => {
    const rig = new Rig();
    rig.keep(["octocat", "hubot"]);
    const read = rig.store.holdRead();
    const held = [rig.github.hold(), rig.github.hold(), rig.github.hold()];
    const restoring = rig.accounts.restoreAsync();

    const adding = rig.accounts.addAsync();
    read();
    await rig.github.askedAsync(3);
    rig.github.requests.forEach((request, index) => held[index]?.(request.url.includes("/login/device/code") ? FakeGitHub.json(grant)
      : userOf(request.header("Authorization")?.includes("gho_hubot") === true ? "hubot" : "octocat")));
    await restoring;
    const added = await adding;

    assert.deepEqual([added.id, rig.accounts.list.accounts.map(t => [t.id, t.signIn.account?.login ?? null])], [3, [[1, "octocat"], [2, "hubot"], [3, null]]]);
  });

  it("keeps an index it can't read and the accounts' tokens, refusing an add and writing no pick over them", async () => {
    const rig = new Rig();
    rig.keep(["octocat", "hubot"]);
    rig.store.values.set("git-github.accounts", "{ not json");
    await rig.restoreAsync(["octocat"]);

    const refusal = await rig.accounts.addAsync().then(() => null, (error: unknown) => error instanceof MethodFailureException ? [error.failure.code, error.failure.message] : null);
    await rig.accounts.pickAsync(new AccountPick("github.com", "octo/app", 1), new AbortController().signal);
    await rig.savedAsync();

    assert.deepEqual([refusal, rig.store.values.get("git-github.accounts"), rig.store.values.has("git-github.account2")], [[FailureCode.Unavailable,
      "The GitHub accounts kept on this computer aren't read, so no account can be added until they are; the ones kept stay as they are."], "{ not json", true]);
  });

  it("signs out an added account while the first stays signed in, forgetting its secret and its picks", async () => {
    const rig = new Rig();
    rig.keep(["octocat", "hubot"], [new AccountPick("github.com", REPOSITORY, 2)]);
    await rig.restoreAsync(["octocat", "hubot"]);

    const answer = await rig.accounts.signOutAsync(2);
    await rig.savedAsync();

    assert.deepEqual([answer, rig.logins(), rig.store.values.has("git-github.account2"), rig.store.values.has("git-github.signIn")],
      [HostSignIn.signedOut(), ["octocat"], false, true]);
    assert.deepEqual(rig.index(), { accounts: [], picks: [] });
  });

  it("ends an added account kept with the first account's login, whatever its case, as already kept, and lets it go once signed out", async () => {
    const rig = new Rig();
    rig.keep(["octocat", "OctoCat"]);
    rig.github.answer(userOf("octocat"), userOf("octocat"));

    await rig.accounts.restoreAsync();
    await rig.untilAsync("2 SignedOut");
    await rig.savedAsync();
    const kept = [rig.accounts.list.accounts.map(t => [t.id, t.signIn.failure]), rig.store.values.has("git-github.account2"), rig.store.values.has("git-github.signIn"), rig.index()];
    await rig.accounts.signOutAsync(2);

    assert.deepEqual(kept, [[[1, null], [2, SignInFailure.AlreadyKept]], false, true, { accounts: [], picks: [] }]);
    assert.deepEqual(rig.accounts.list.accounts.map(t => t.id), [1]);
    assert.ok(linesOf(rig.log).includes("An added GitHub account signed in as an account already kept here, so its token was forgotten and it ended signed out as already kept."));
  });

  it("ends an added account that signs in as an account already kept as already kept, and never answers it signed in", async () => {
    MockClock.use(1_800_000_000_000);
    const rig = new Rig();
    rig.keep(["octocat"]);
    await rig.restoreAsync(["octocat"]);
    rig.github.answer(FakeGitHub.json(grant), FakeGitHub.json({ access_token: "gho_again", token_type: "bearer", scope: "repo" }), userOf("octocat"));

    await rig.accounts.addAsync();
    await vi.advanceTimersByTimeAsync(5_000);
    await rig.untilAsync("2 SignedOut");

    assert.deepEqual([rig.logins(), rig.accounts.list.accounts.map(t => t.signIn.failure), rig.accounts.holds("gho_again"), rig.store.values.has("git-github.account2")],
      [["octocat", null], [null, SignInFailure.AlreadyKept], false, false]);
    assert.ok(!rig.changes.includes("2 SignedIn"));
  });

  it("keeps the first account when it signs in as an added account's login, and ends the added one as already kept", async () => {
    MockClock.use(1_800_000_000_000);
    const rig = new Rig();
    rig.store.values.set("git-github.account2", keptOf("octocat"));
    rig.store.values.set("git-github.accounts", JSON.stringify({ accounts: [{ id: 2, host: "github.com", login: "octocat" }], picks: [] }));
    rig.github.answer(userOf("octocat"), FakeGitHub.json(grant), FakeGitHub.json({ access_token: "gho_first", token_type: "bearer", scope: "repo" }), userOf("octocat"));
    await rig.accounts.restoreAsync();
    await rig.untilAsync("2 SignedIn");
    await rig.github.askedAsync(1);

    await rig.accounts.first.startAsync();
    await vi.advanceTimersByTimeAsync(5_000);
    await rig.untilAsync("2 SignedOut");

    assert.deepEqual([rig.logins(), rig.accounts.signedIn.map(t => [t.id, t.token]), rig.store.values.has("git-github.account2")], [["octocat", null], [[1, "gho_first"]], false]);
    assert.ok(rig.changes.includes("1 SignedIn"));
  });

  it("logs a duplicate account whose secret removal breaks, and still ends it as already kept", async () => {
    const rig = new Rig();
    rig.keep(["octocat", "octocat"]);
    rig.store.removeFailure = new RangeError("Unexpected.");
    rig.github.answer(userOf("octocat"), userOf("octocat"));

    await rig.accounts.restoreAsync();
    await rig.untilAsync("2 SignedOut");
    await rig.savedAsync();

    assert.deepEqual(rig.accounts.list.accounts.map(t => [t.id, t.signIn.failure]), [[1, null], [2, SignInFailure.AlreadyKept]]);
    assert.ok(linesOf(rig.log).includes("The GitHub sign-in stopped on an unexpected failure: RangeError: Unexpected."));
  });

  it("keeps a first account that signs out in the list, signed out, while an added one stays signed in", async () => {
    const rig = new Rig();
    rig.keep(["octocat", "hubot"]);
    await rig.restoreAsync(["octocat", "hubot"]);

    await rig.accounts.signOutAsync(1);

    assert.deepEqual([rig.logins(), rig.accounts.signedIn.map(t => t.id), rig.store.values.has("git-github.account2")], [[null, "hubot"], [2], true]);
  });

  it("keeps an added account GitHub revoked in the list with its failure, and drops it when the person signs it out", async () => {
    const rig = new Rig();
    rig.keep(["octocat", "hubot"]);
    await rig.restoreAsync(["octocat", "hubot"]);

    await rig.accounts.refusedAsync("gho_hubot");
    const revoked = rig.accounts.list.accounts.map(t => [t.id, t.signIn.failure]);
    await rig.accounts.signOutAsync(2);

    assert.deepEqual([revoked, rig.accounts.list.accounts.map(t => t.id), rig.accounts.holds("gho_hubot"), rig.accounts.holds("gho_octocat")],
      [[[1, null], [2, SignInFailure.Revoked]], [1], false, true]);
  });

  it("refuses an account it doesn't keep as NotFound", async () => {
    const rig = new Rig();
    await rig.accounts.restoreAsync();

    assert.throws(() => rig.accounts.signInOf(2), t => t instanceof MethodFailureException && t.failure.code === FailureCode.NotFound);
    await assert.rejects(rig.accounts.signOutAsync(2), { name: "MethodFailureException" });
    await assert.rejects(rig.accounts.pickAsync(new AccountPick("github.com", REPOSITORY, 2), new AbortController().signal), { name: "MethodFailureException" });
  });

  it("answers no account while none is signed in, and the only one signed in without asking GitHub", async () => {
    const none = new Rig();
    await none.accounts.restoreAsync();
    const one = new Rig();
    one.store.values.set("git-github.signIn", keptOf("octocat"));
    await one.restoreAsync(["octocat"]);
    const signal = new AbortController().signal;

    assert.deepEqual([await none.accounts.accountForAsync("github.com", REPOSITORY, signal), await none.accounts.tokenForAsync("github.com", REPOSITORY, signal)], [null, null]);
    assert.deepEqual([await one.accounts.accountForAsync("github.com", REPOSITORY, signal), await one.accounts.tokenForAsync("github.com", REPOSITORY, signal)], [1, "gho_octocat"]);
    assert.equal(one.github.requests.length, 0);
  });

  it("reads a repository with the account picked for it, remembering the pick in the index, without asking GitHub", async () => {
    const rig = new Rig();
    rig.keep(["octocat", "hubot"]);
    await rig.restoreAsync(["octocat", "hubot"]);
    const signal = new AbortController().signal;

    const picked = await rig.accounts.pickAsync(new AccountPick("github.com", REPOSITORY, 2), signal);
    await rig.savedAsync();

    assert.deepEqual([picked, await rig.accounts.tokenForAsync("github.com", REPOSITORY, signal), rig.github.requests.length], [2, "gho_hubot", 0]);
    assert.deepEqual(rig.index(), { accounts: [{ id: 2, host: "github.com", login: "hubot" }], picks: [{ host: "github.com", path: REPOSITORY, account: 2 }] });
  });

  it("restores a kept pick, and passes over it while its account is signed out", async () => {
    const rig = new Rig();
    rig.keep(["octocat", "hubot"], [new AccountPick("github.com", REPOSITORY, 1)]);
    await rig.restoreAsync(["octocat", "hubot"]);
    const signal = new AbortController().signal;

    const restored = await rig.accounts.accountForAsync("github.com", REPOSITORY, signal);
    await rig.accounts.signOutAsync(1);

    assert.deepEqual([restored, await rig.accounts.accountForAsync("github.com", REPOSITORY, signal), rig.github.requests.length], [1, 2, 0]);
  });

  it("keeps the newest 200 picks, a repository picked again counting as new", async () => {
    const rig = new Rig();
    rig.keep(["octocat", "hubot"]);
    await rig.restoreAsync(["octocat", "hubot"]);
    const signal = new AbortController().signal;

    for (let index = 0; index < 201; index++)
      await rig.accounts.pickAsync(new AccountPick("github.com", `octocat/r${index}`, 2), signal);
    await rig.accounts.pickAsync(new AccountPick("github.com", "octocat/r5", 1), signal);
    await rig.savedAsync();
    const picks = (rig.index() as { picks: { path: string; account: number }[] }).picks;

    assert.deepEqual([picks.length, picks[0]?.path, picks.at(-1), picks.some(t => t.path === "octocat/r0")],
      [200, "octocat/r1", { host: "github.com", path: "octocat/r5", account: 1 }, false]);
  });

  it("reads a repository nobody picked with the first signed-in account that can read it, asking GitHub once a session", async () => {
    const rig = new Rig();
    rig.keep(["octocat", "hubot"]);
    await rig.restoreAsync(["octocat", "hubot"]);
    rig.github.answer(missing(), repository());
    const signal = new AbortController().signal;

    const [first, second] = await Promise.all([rig.accounts.accountForAsync("github.com", REPOSITORY, signal), rig.accounts.accountForAsync("github.com", REPOSITORY, signal)]);
    const again = await rig.accounts.accountForAsync("github.com", REPOSITORY, signal);

    assert.deepEqual([first, second, again], [2, 2, 2]);
    assert.deepEqual(rig.github.requests.map(t => [t.url, t.header("Authorization")]),
      [["https://api.github.com/repos/octocat/hello-world", "Bearer gho_octocat"], ["https://api.github.com/repos/octocat/hello-world", "Bearer gho_hubot"]]);
  });

  it("falls back to the first signed-in account when none can read the repository, or for a path that isn't a repository's or another host", async () => {
    const rig = new Rig();
    rig.keep(["octocat", "hubot"]);
    await rig.restoreAsync(["octocat", "hubot"]);
    rig.github.answer(missing(), missing());
    const signal = new AbortController().signal;

    const answers = [await rig.accounts.accountForAsync("github.com", REPOSITORY, signal), await rig.accounts.accountForAsync("github.com", "octocat", signal),
      await rig.accounts.accountForAsync("dev.azure.com", "fabrikam/web/_git/site", signal)];

    assert.deepEqual([answers, rig.github.requests.length], [[1, 1, 1], 2]);
  });

  it("takes the first signed-in account without keeping the answer when GitHub can't be reached during the check, and asks again next time", async () => {
    const rig = new Rig();
    rig.keep(["octocat", "hubot"]);
    await rig.restoreAsync(["octocat", "hubot"]);
    rig.github.fail(new TypeError("fetch failed"));
    rig.github.answer(missing(), repository());
    const signal = new AbortController().signal;

    const failed = await rig.accounts.accountForAsync("github.com", REPOSITORY, signal);
    const next = await rig.accounts.accountForAsync("github.com", REPOSITORY, signal);

    assert.deepEqual([failed, next, rig.github.requests.length], [1, 2, 3]);
  });

  it.each([[403, "Resource protected by organization SAML enforcement"], [500, "Server Error"]])(
    "goes on to the next account when GitHub answers the first account's check with %i, and asks again next time when none could read it", async (status, message) => {
      const rig = new Rig();
      rig.keep(["octocat", "hubot"]);
      await rig.restoreAsync(["octocat", "hubot"]);
      rig.github.answer(FakeGitHub.json({ message }, status), repository(), FakeGitHub.json({ message }, status), missing(), missing(), missing());
      const signal = new AbortController().signal;

      const reached = await rig.accounts.accountForAsync("github.com", "octocat/other", signal);
      const fallback = await rig.accounts.accountForAsync("github.com", REPOSITORY, signal);
      const again = await rig.accounts.accountForAsync("github.com", REPOSITORY, signal);

      assert.deepEqual([reached, fallback, again, rig.github.requests.length], [2, 1, 1, 6]);
    });

  it("matches a pick with the repository's host and path whatever their case, as GitHub does, and replaces it whatever case picked it", async () => {
    const rig = new Rig();
    rig.keep(["octocat", "hubot"], [new AccountPick("github.com", "Octocat/Hello-World", 2)]);
    await rig.restoreAsync(["octocat", "hubot"]);
    const signal = new AbortController().signal;

    const kept = await rig.accounts.accountForAsync("GitHub.com", REPOSITORY, signal);
    await rig.accounts.pickAsync(new AccountPick("github.com", "OCTOCAT/hello-world", 1), signal);
    await rig.savedAsync();

    assert.deepEqual([kept, await rig.accounts.accountForAsync("github.com", REPOSITORY, signal), rig.github.requests.length], [2, 1, 0]);
    assert.deepEqual((rig.index() as { picks: unknown[] }).picks, [{ host: "github.com", path: "OCTOCAT/hello-world", account: 1 }]);
  });

  it("reports a token GitHub refuses during the check to its account, and goes on to the next", async () => {
    const rig = new Rig();
    rig.keep(["octocat", "hubot"]);
    await rig.restoreAsync(["octocat", "hubot"]);
    rig.github.answer(FakeGitHub.json({ message: "Bad credentials" }, 401), repository());

    const chosen = await rig.accounts.accountForAsync("github.com", REPOSITORY, new AbortController().signal);

    assert.deepEqual([chosen, rig.accounts.list.accounts.map(t => [t.id, t.signIn.failure])], [2, [[1, SignInFailure.Revoked], [2, null]]]);
  });

  it("answers the account still signed in when the one GitHub chose signs out during the check, and rejects a withdrawn call", async () => {
    const rig = new Rig();
    rig.keep(["octocat", "hubot"]);
    await rig.restoreAsync(["octocat", "hubot"]);
    const release = rig.github.hold();
    const stop = new AbortController();

    const withdrawn = rig.accounts.accountForAsync("github.com", REPOSITORY, stop.signal);
    const chosen = rig.accounts.accountForAsync("github.com", REPOSITORY, new AbortController().signal);
    await rig.github.askedAsync(1);
    await rig.accounts.signOutAsync(1);
    stop.abort(new Error("Withdrawn."));
    release(repository());

    await assert.rejects(withdrawn, { message: "Withdrawn." });
    assert.deepEqual(await chosen, 2);
  });

  it("answers no account when every account signs out during the check", async () => {
    const rig = new Rig();
    rig.keep(["octocat", "hubot"]);
    await rig.restoreAsync(["octocat", "hubot"]);
    const release = rig.github.hold();

    const chosen = rig.accounts.accountForAsync("github.com", REPOSITORY, new AbortController().signal);
    await rig.github.askedAsync(1);
    await rig.accounts.signOutAsync(1);
    await rig.accounts.signOutAsync(2);
    release(repository());

    assert.equal(await chosen, null);
  });

  it("asks again after an account changes, since the answer may differ", async () => {
    const rig = new Rig();
    rig.keep(["octocat", "hubot", "monalisa"]);
    await rig.restoreAsync(["octocat", "hubot", "monalisa"]);
    rig.github.answer(missing(), repository(), repository());
    const signal = new AbortController().signal;

    const before = await rig.accounts.accountForAsync("github.com", REPOSITORY, signal);
    await rig.accounts.signOutAsync(3);
    const after = await rig.accounts.accountForAsync("github.com", REPOSITORY, signal);

    assert.deepEqual([before, after, rig.github.requests.length], [2, 1, 3]);
  });

  it("says so when the index can't be kept, without failing the sign-in", async () => {
    const refused = new Rig();
    refused.keep(["octocat", "hubot"]);
    await refused.restoreAsync(["octocat", "hubot"]);
    refused.store.saveFailure = KeptSecrets.failure(SecretFailureReason.Unprotected);
    await refused.accounts.pickAsync(new AccountPick("github.com", REPOSITORY, 2), new AbortController().signal);
    await refused.savedAsync();

    const broken = new Rig();
    broken.keep(["octocat", "hubot"]);
    await broken.restoreAsync(["octocat", "hubot"]);
    broken.store.saveFailure = new RangeError("Unexpected.");
    await broken.accounts.pickAsync(new AccountPick("github.com", REPOSITORY, 2), new AbortController().signal);
    await broken.savedAsync();

    assert.deepEqual(linesOf(refused.log).at(-1), "The GitHub accounts couldn't be kept on this computer; added accounts and chosen accounts last until the app closes.");
    assert.match(linesOf(broken.log).at(-1) ?? "", /RangeError: Unexpected\./);
  });

  it("stops every account and its changes once disposed", async () => {
    const rig = new Rig();
    rig.keep(["octocat", "hubot"]);
    rig.store.readFailure = KeptSecrets.failure(SecretFailureReason.NotConnected);
    await rig.accounts.restoreAsync();

    rig.accounts.dispose();
    const changes = rig.changes.length;
    await rig.accounts.restoreAsync();

    assert.deepEqual([rig.appWindows.activeCallsOf("onChanged").length, rig.changes.length, changes], [0, 0, 0]);
  });
});
