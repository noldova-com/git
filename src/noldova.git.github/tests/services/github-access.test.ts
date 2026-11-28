/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { Failure, FailureCode, SecretFailureReason } from "@noldova/desktop.protocol";
import { MethodFailureException } from "@noldova/desktop.runtime";
import { FakeAppWindows, FakeModuleLog, FakeModuleSecrets } from "@noldova/desktop.runtime/testing";
import { GitHubAccessGrant, GitHubAccessQuery, GitHubAccessRefusal } from "@noldova/git.github.protocol";
import { HostAccount, HostSignIn } from "@noldova/git.hosting.protocol";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

import { GitHubAccess } from "../../src/services/github-access.ts";
import { GitHubAvatars } from "../../src/services/github-avatars.ts";
import { GitHubDeviceFlow } from "../../src/services/github-device-flow.ts";
import { GitHubFolderUsers } from "../../src/services/github-folder-users.ts";
import { GitHubSignIn } from "../../src/services/github-sign-in.ts";
import { FakeGitHub, FakeToken, KeptSecrets } from "../fixtures/fake-github.fixture.ts";
import { FakeRepositories } from "../fixtures/fake-tools.fixture.ts";

const grant = { device_code: "3584d83530557fdd1f46af8289938c8ef79f9dc5", user_code: "WDJB-MJHT", verification_uri: "https://github.com/login/device", expires_in: 900, interval: 5 };
const signal: AbortSignal = new AbortController().signal;
const account: HostAccount = new HostAccount("octocat", "The Octocat", null, ["repo"]);

const REPOSITORY: GitHubAccessQuery = new GitHubAccessQuery("github.com", "octocat/hello-world");

interface IAccessSignIn {
  readonly current: HostSignIn;
  readonly token: string | null;
  readonly keptUnreadable: boolean;
}

class FakeSignIn implements IAccessSignIn {
  public reads: number = 0;
  public readonly token: string | null;
  public readonly keptUnreadable: boolean;
  private readonly signIn: HostSignIn;

  public constructor(signIn: HostSignIn, token: string | null, keptUnreadable: boolean = false) {
    this.signIn = signIn;
    this.token = token;
    this.keptUnreadable = keptUnreadable;
  }

  public get current(): HostSignIn {
    this.reads++;
    return this.signIn;
  }
}

class FakeAccounts {
  public readonly first: IAccessSignIn;
  private readonly others: ReadonlyMap<number, IAccessSignIn>;
  private readonly chosen: number | null;
  private readonly steps: string[];

  public constructor(first: IAccessSignIn, others: ReadonlyMap<number, IAccessSignIn>, chosen: number | null, steps: string[]) {
    this.first = first;
    this.others = others;
    this.chosen = chosen;
    this.steps = steps;
  }

  public accountForAsync(host: string, path: string): Promise<number | null> {
    this.steps.push(`account ${host}/${path}`);
    return Promise.resolve(this.chosen);
  }

  public signInOf(id: number): IAccessSignIn {
    return id === 1 ? this.first : this.others.get(id) ?? this.first;
  }
}

class FakeFolders {
  private readonly steps: string[];

  public constructor(steps: string[]) {
    this.steps = steps;
  }

  public useAsync(folder: string, remote: string, host: string, path: string): Promise<void> {
    this.steps.push(`use ${folder} ${remote} ${host}/${path}`);
    return Promise.resolve();
  }
}

class Access {
  public static signInOf(github: FakeGitHub, secrets: FakeModuleSecrets = new FakeModuleSecrets()): GitHubSignIn {
    return new GitHubSignIn(new GitHubDeviceFlow(github.fetch, new GitHubAvatars(github.fetch, new FakeModuleLog())), secrets, new FakeAppWindows(), new FakeModuleLog(),
      () => undefined);
  }

  public static of(first: IAccessSignIn, others: ReadonlyMap<number, IAccessSignIn> = new Map(), chosen: number | null = null, steps: string[] = []): GitHubAccess {
    return new GitHubAccess(new FakeAccounts(first, others, chosen, steps), new FakeFolders(steps));
  }
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
    const waiting = Access.signInOf(github);
    const secrets = new FakeModuleSecrets();
    new KeptSecrets(secrets).values.set("git-github.signIn", JSON.stringify({ token: "gho_kept", account: account.toJson() }));
    const restored = Access.signInOf(new FakeGitHub(), secrets);
    const before = await Access.of(waiting).accessAsync(signal);

    await waiting.startAsync();
    const whileWaiting = await Access.of(waiting).accessAsync(signal);
    await restored.restoreAsync();
    const signedIn = await Access.of(restored).accessAsync(signal);
    await restored.refusedAsync("gho_kept");
    const revoked = await Access.of(restored).accessAsync(signal);
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
    const answer = await Access.of(new FakeSignIn(HostSignIn.signedOut(), "gho_stale")).accessAsync(signal);

    assert.deepEqual(answer, new GitHubAccessRefusal("Sign in to GitHub in Settings, GitHub."));
  });

  it("answers that the kept sign-in couldn't be read when Noldova Desktop refused to read it", async () => {
    const unreadable = new FakeModuleSecrets();
    unreadable.answer("readAsync", () => Promise.reject(KeptSecrets.failure(SecretFailureReason.Unprotected)));
    const signIn = Access.signInOf(new FakeGitHub(), unreadable);

    await signIn.restoreAsync();
    const answer = await Access.of(signIn).accessAsync(signal);
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
    const unconnected = await Promise.all([nothingKept, restored].map(t => Access.of(t).accessAsync(signal)));
    empty.readFailure = null;
    kept.readFailure = null;
    kept.values.set("git-github.signIn", JSON.stringify({ token: "gho_kept", account: account.toJson() }));
    emptyWindows.raiseChanged();
    keptWindows.raiseChanged();
    await vi.advanceTimersByTimeAsync(0);
    const connected = await Promise.all([nothingKept, restored].map(t => Access.of(t).accessAsync(signal)));
    nothingKept.dispose();
    restored.dispose();

    const signedOut = new GitHubAccessRefusal("Sign in to GitHub in Settings, GitHub.");
    assert.deepEqual(unconnected, [signedOut, signedOut]);
    assert.deepEqual(connected, [signedOut, new GitHubAccessGrant("gho_kept", "octocat")]);
  });

  it("answers no token once the sign-in stops", async () => {
    const secrets = new FakeModuleSecrets();
    new KeptSecrets(secrets).values.set("git-github.signIn", JSON.stringify({ token: "gho_kept", account: account.toJson() }));
    const signIn = Access.signInOf(new FakeGitHub(), secrets);
    await signIn.restoreAsync();
    const before = await Access.of(signIn).accessAsync(signal);

    signIn.dispose();

    assert.deepEqual([before, signIn.token, await Access.of(signIn).accessAsync(signal)],
      [new GitHubAccessGrant("gho_kept", "octocat"), null, new GitHubAccessRefusal("Sign in to GitHub in Settings, GitHub.")]);
  });

  it("refuses an aborted call with the signal's reason, before reading the sign-in", async () => {
    const stop = new AbortController();
    const reason = new Error("The turn was cancelled.");
    stop.abort(reason);
    const signIn = new FakeSignIn(HostSignIn.signedIn(account), "gho_token");

    await assert.rejects(Access.of(signIn).accessAsync(stop.signal), t => t === reason);
    assert.equal(signIn.reads, 0);
  });

  it("answers the account the module reads a repository with, its host, and the first account's reason when none is signed in", async () => {
    const first = new FakeSignIn(HostSignIn.signedOut(), null, true);
    const second = new FakeSignIn(HostSignIn.signedIn(new HostAccount("hubot", null, null, ["repo"])), "gho_hubot");

    const answers = [await Access.of(first, new Map([[2, second]]), 2).accessForAsync(REPOSITORY, signal), await Access.of(first).accessForAsync(REPOSITORY, signal),
      await Access.of(first, new Map([[2, second]]), 2).accessAsync(signal)];

    assert.deepEqual(answers, [new GitHubAccessGrant("gho_hubot", "hubot", "github.com"),
      new GitHubAccessRefusal("The GitHub sign-in kept on this computer couldn't be read; sign in again in Settings, GitHub."),
      new GitHubAccessRefusal("The GitHub sign-in kept on this computer couldn't be read; sign in again in Settings, GitHub.")]);
  });

  it("refuses an aborted call for a repository with the signal's reason", async () => {
    const stop = new AbortController();
    const reason = new Error("The turn was cancelled.");
    stop.abort(reason);

    await assert.rejects(Access.of(new FakeSignIn(HostSignIn.signedOut(), null)).accessForAsync(REPOSITORY, stop.signal), t => t === reason);
  });

  it("reads the user name in a given folder's remote, origin unless another is named, before it chooses the account, and reads none without a folder", async () => {
    const second = new FakeSignIn(HostSignIn.signedIn(new HostAccount("hubot", null, null, ["repo"])), "gho_hubot");
    const steps: string[] = [];
    const access = Access.of(new FakeSignIn(HostSignIn.signedOut(), null), new Map([[2, second]]), 2, steps);

    const answers = [await access.accessForAsync(new GitHubAccessQuery("github.com", "octocat/hello-world", "/home/kim/hello-world"), signal),
      await access.accessForAsync(new GitHubAccessQuery("github.com", "octocat/hello-world", "/home/kim/hello-world", "upstream"), signal),
      await access.accessForAsync(REPOSITORY, signal)];

    assert.deepEqual(answers.map(t => "login" in t ? t.login : null), ["hubot", "hubot", "hubot"]);
    assert.deepEqual(steps, ["use /home/kim/hello-world origin github.com/octocat/hello-world", "account github.com/octocat/hello-world",
      "use /home/kim/hello-world upstream github.com/octocat/hello-world", "account github.com/octocat/hello-world", "account github.com/octocat/hello-world"]);
  });

  it("answers for a folder Git can't read as it does without a folder, rather than failing the call", async () => {
    const second = new FakeSignIn(HostSignIn.signedIn(new HostAccount("hubot", null, null, ["repo"])), "gho_hubot");
    const repositories = new FakeRepositories();
    repositories.answer = new MethodFailureException(new Failure(FailureCode.NotFound, "The folder isn't a Git repository."));
    const tokens = new FakeToken();
    const steps: string[] = [];
    const access = new GitHubAccess(new FakeAccounts(new FakeSignIn(HostSignIn.signedOut(), null), new Map([[2, second]]), 2, steps),
      new GitHubFolderUsers(tokens, () => repositories));

    const answers = [await access.accessForAsync(new GitHubAccessQuery("github.com", "octocat/hello-world", "/home/kim/missing"), signal),
      await access.accessForAsync(REPOSITORY, signal)];

    assert.deepEqual([answers, tokens.users, steps], [[new GitHubAccessGrant("gho_hubot", "hubot", "github.com"), new GitHubAccessGrant("gho_hubot", "hubot", "github.com")],
      [], ["account github.com/octocat/hello-world", "account github.com/octocat/hello-world"]]);
  });
});
