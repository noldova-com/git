/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import type { JsonValue } from "@noldova/context.json";
import { FailureCode, SecretFailureReason, ShellClients } from "@noldova/desktop.protocol";
import { MethodFailureException, RequestContext, ToolFailure, ToolFailureCode } from "@noldova/desktop.runtime";
import { GitHubAccessGrant, GitHubAccessRefusal } from "@noldova/git.github.protocol";
import { GitRemote, RemoteTransport } from "@noldova/git.protocol";
import { AuthorQuery, BranchPullRequest, BranchQuery, CommitQuery, DeviceCode, HostAccount, HostComment, HostCommitComments, HostItem, HostPerson, HostPullRequestList,
  HostPullRequestThreads, HostReference, HostReviewRequestList, HostSignIn, HostThread, PullRequestDraft, RepositoryQuery, ThreadStatus } from "@noldova/git.hosting.protocol";
import { afterEach, describe, it, vi } from "vitest";

import { RuntimePart } from "../src/api/index.ts";
import { GitHubAccess } from "../src/services/github-access.ts";
import { FakeGitHub, KeptSecrets, linesOf } from "./fixtures/fake-github.fixture.ts";
import { FakeRepositories, statusOf } from "./fixtures/fake-tools.fixture.ts";
import { MockClock } from "./fixtures/mock-clock.fixture.ts";
import { RuntimeContext } from "./fixtures/runtime-context.fixture.ts";

const grant = { device_code: "3584d83530557fdd1f46af8289938c8ef79f9dc5", user_code: "WDJB-MJHT", verification_uri: "https://github.com/login/device", expires_in: 900, interval: 5 };
const account: HostAccount = new HostAccount("octocat", "The Octocat", null, ["repo"]);
const avatarUrl: string = "https://avatars.githubusercontent.com/u/583231";

async function callAsync(context: RuntimeContext, name: string, payload: JsonValue = null, client: string = "git-github",
  window: number | null = null): Promise<JsonValue> {
  const handler = context.methods.get(name);
  assert.ok(handler !== undefined, `${name} isn't registered.`);
  return handler.handleAsync(new RequestContext(client, payload, new AbortController().signal, 1, window));
}

function failureOf(error: unknown): readonly string[] | null {
  return error instanceof MethodFailureException ? [error.failure.code, error.failure.message] : null;
}

describe("RuntimePart", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("is active from its activation until its deactivation", async () => {
    const part: RuntimePart = new RuntimePart();
    const context: RuntimeContext = new RuntimeContext();

    const states: boolean[] = [part.isActive];
    await part.activateAsync(context.fake);
    states.push(part.isActive);
    await part.deactivateAsync();
    states.push(part.isActive);

    assert.deepEqual(states, [false, true, false]);
  });

  it("offers its agent tools while active and withdraws them on deactivation", async () => {
    const part: RuntimePart = new RuntimePart();
    const context: RuntimeContext = new RuntimeContext();

    await part.activateAsync(context.fake);
    const session = context.tools.openSession("chat-1", {});
    const offered: readonly string[] = session.listTools().map(t => t.name);
    await part.deactivateAsync();

    assert.deepEqual([offered, session.listTools().map(t => t.name)], [["git_github_read", "git_github_pr_checks", "git_github_pr_create"], []]);
  });

  it("reads the bound folder through the Git module's git.repositories at call time, and fails as Unavailable while it can't reach it", async () => {
    const part: RuntimePart = new RuntimePart();
    const context: RuntimeContext = new RuntimeContext();
    const repositories: FakeRepositories = new FakeRepositories();

    await part.activateAsync(context.fake);
    const session = context.tools.openSession("chat-1", { "git.folder": "/home/monalisa/hello-world" });
    const unreachable = await session.callAsync("git_github_pr_checks", {});
    context.services.set("git.repositories", repositories);
    const reached = await session.callAsync("git_github_pr_checks", {});
    await part.deactivateAsync();

    assert.deepEqual([unreachable, reached].map(t => t instanceof ToolFailure ? [t.code, t.moduleCode] : null),
      [[ToolFailureCode.Unavailable, "git-github.gitUnavailable"], [ToolFailureCode.Unavailable, "git-github.signedOut"]]);
    assert.deepEqual(repositories.folders, ["/home/monalisa/hello-world"]);
  });

  it("serves the sign-in through its methods and publishes each change on its event, asking GitHub with the global fetch", async () => {
    MockClock.use(1_800_000_000_000);
    const github = new FakeGitHub();
    github.answer(FakeGitHub.json(grant));
    vi.stubGlobal("fetch", github.fetch);
    const part = new RuntimePart();
    const context = new RuntimeContext();

    await part.activateAsync(context.fake);
    const answers = [await callAsync(context, "git-github.readSignIn"), await callAsync(context, "git-github.startSignIn"),
      await callAsync(context, "git-github.cancelSignIn"), await callAsync(context, "git-github.signOut")];
    await part.deactivateAsync();

    const waiting = HostSignIn.waiting(new DeviceCode("WDJB-MJHT", "https://github.com/login/device", 1_800_000_900_000)).toJson();
    assert.deepEqual([...context.methods.keys()], ["git-github.readSignIn", "git-github.startSignIn", "git-github.cancelSignIn", "git-github.signOut",
      "git-github.readReference", "git-github.readBranchPullRequest", "git-github.readAuthorAvatar", "git-github.readPullRequests", "git-github.readReviewRequests",
      "git-github.readCommitComments", "git-github.readPullRequest", "git-github.readPullRequestThreads", "git-github.readCommitPullRequest",
      "git-github.createPullRequest", "git-github.readAccounts", "git-github.addAccount", "git-github.readRepositoryAccount", "git-github.pickAccount",
      "git-github.useFolder"]);
    assert.deepEqual(answers, [HostSignIn.signedOut().toJson(), waiting, HostSignIn.signedOut().toJson(), HostSignIn.signedOut().toJson()]);
    assert.deepEqual([context.events.get("git-github.signInChanged"), github.urls()], [[waiting, HostSignIn.signedOut().toJson()], ["https://github.com/login/device/code"]]);
  });

  it("serves every account: lists them, acts on one by its id, adds one, and picks the one a repository is read with, publishing each change", async () => {
    const github = new FakeGitHub();
    github.answer(FakeGitHub.json({ login: "octocat", name: null, avatar_url: null }, 200, { "X-OAuth-Scopes": "repo" }),
      FakeGitHub.json({ login: "hubot", name: null, avatar_url: null }, 200, { "X-OAuth-Scopes": "repo" }));
    vi.stubGlobal("fetch", github.fetch);
    const part = new RuntimePart();
    const context = new RuntimeContext();
    const hubot = new HostAccount("hubot", null, null, ["repo"]);
    context.secrets.values.set("git-github.signIn", JSON.stringify({ token: "gho_octocat", account: new HostAccount("octocat", null, null, ["repo"]).toJson() }));
    context.secrets.values.set("git-github.account2", JSON.stringify({ token: "gho_hubot", account: hubot.toJson() }));
    context.secrets.values.set("git-github.accounts", JSON.stringify({ accounts: [{ id: 2, host: "github.com", login: "hubot" }], picks: [] }));
    const repository = { host: "github.com", path: "octocat/hello-world" };

    await part.activateAsync(context.fake);
    await github.askedAsync(2);
    github.answer(FakeGitHub.json(grant));
    const listed = await callAsync(context, "git-github.readAccounts");
    const second = await callAsync(context, "git-github.readSignIn", { account: 2 });
    const picked = await callAsync(context, "git-github.pickAccount", { ...repository, account: 2 });
    const read = await callAsync(context, "git-github.readRepositoryAccount", repository);
    const added = await callAsync(context, "git-github.addAccount");
    const cancelled = await callAsync(context, "git-github.cancelSignIn", { account: 3 });
    const signedOut = await callAsync(context, "git-github.signOut", { account: 2 });
    const failures = await Promise.all([callAsync(context, "git-github.readSignIn", { account: 9 }), callAsync(context, "git-github.readSignIn", { account: 0 }),
      callAsync(context, "git-github.readRepositoryAccount", { host: "github.com" })].map(t => t.then(() => null, failureOf)));
    const events = context.events.get("git-github.accountsChanged") ?? [];
    await part.deactivateAsync();

    assert.deepEqual([(listed as { accounts: { id: number }[] }).accounts.map(t => t.id), second, picked, read],
      [[1, 2], HostSignIn.signedIn(hubot).toJson(), { account: 2 }, { account: 2 }]);
    assert.deepEqual([(added as { id: number }).id, cancelled, signedOut, failures.map(t => t?.[0])],
      [3, HostSignIn.signedOut().toJson(), HostSignIn.signedOut().toJson(), [FailureCode.NotFound, FailureCode.InvalidParams, FailureCode.InvalidParams]]);
    assert.deepEqual(events.at(-1), { accounts: [{ id: 1, signIn: HostSignIn.signedIn(new HostAccount("octocat", null, null, ["repo"])).toJson() }] });
    assert.equal(context.events.get("git-github.signInChanged")?.every(t => (t as { account: { login: string } | null }).account?.login !== "hubot"), true);
  });

  it("reads a window's folder's remote, choosing the account its user name names, and answers no account for a remote off a host and path", async () => {
    const github = new FakeGitHub();
    github.answer(FakeGitHub.json({ login: "octocat", name: null, avatar_url: null }, 200, { "X-OAuth-Scopes": "repo" }),
      FakeGitHub.json({ login: "hubot", name: null, avatar_url: null }, 200, { "X-OAuth-Scopes": "repo" }));
    vi.stubGlobal("fetch", github.fetch);
    const part = new RuntimePart();
    const context = new RuntimeContext();
    const repositories = new FakeRepositories();
    context.secrets.values.set("git-github.signIn", JSON.stringify({ token: "gho_octocat", account: new HostAccount("octocat", null, null, ["repo"]).toJson() }));
    context.secrets.values.set("git-github.account2", JSON.stringify({ token: "gho_hubot", account: new HostAccount("hubot", null, null, ["repo"]).toJson() }));
    context.secrets.values.set("git-github.accounts", JSON.stringify({ accounts: [{ id: 2, host: "github.com", login: "hubot" }], picks: [] }));
    repositories.users.set("origin", "hubot");
    repositories.remotes.set("local", new GitRemote("local", null, "srv/hello-world.git", RemoteTransport.File));
    repositories.remotes.set("bare", new GitRemote("bare", "github.com", null, RemoteTransport.Https));
    const folder = { folder: "/home/monalisa/hello-world", remote: "origin" };
    const useAsync = (payload: JsonValue, client: string = ShellClients.mainProcess, window: number | null = 1): Promise<JsonValue> =>
      callAsync(context, "git-github.useFolder", payload, client, window);

    await part.activateAsync(context.fake);
    await github.askedAsync(2);
    const missing = await useAsync(folder).then(() => null, failureOf);
    context.services.set("git.repositories", repositories);
    const refused = await Promise.all([useAsync(folder, "git-github"), useAsync(folder, ShellClients.mainProcess, null), useAsync({ folder: "/home/monalisa/hello-world" })]
      .map(t => t.then(() => null, failureOf)));
    const used = await useAsync(folder);
    const read = await callAsync(context, "git-github.readRepositoryAccount", { host: "github.com", path: "octocat/hello-world" });
    const offHost = await Promise.all([useAsync({ ...folder, remote: "local" }), useAsync({ ...folder, remote: "bare" })]);
    repositories.users.clear();
    github.answer(FakeGitHub.json({ full_name: "octocat/hello-world" }));
    const forgotten = await useAsync(folder);
    repositories.answer = statusOf("fix-bug", null, null);
    offHost.push(await useAsync(folder));
    await part.deactivateAsync();

    assert.deepEqual([missing, refused.map(t => t?.[0])], [[FailureCode.Unavailable, "The Git module isn't active, so the folder's remote can't be read."],
      [FailureCode.Unauthorized, FailureCode.Unauthorized, FailureCode.InvalidParams]]);
    assert.deepEqual([used, read, offHost, forgotten], [{ account: 2 }, { account: 2 }, [{ account: null }, { account: null }, { account: null }], { account: 1 }]);
    assert.deepEqual(repositories.userReads, [["/home/monalisa/hello-world", "origin"], ["/home/monalisa/hello-world", "origin"]]);
  });

  it("restores the kept sign-in on activation and stops following the app's windows on deactivation", async () => {
    const github = new FakeGitHub();
    const release = github.hold();
    vi.stubGlobal("fetch", github.fetch);
    const kept = new RuntimePart();
    const keptContext = new RuntimeContext();
    keptContext.secrets.values.set("git-github.signIn", JSON.stringify({ token: "gho_token", account: account.toJson() }));
    const waiting = new RuntimePart();
    const waitingContext = new RuntimeContext();
    waitingContext.secrets.readFailure = KeptSecrets.failure(SecretFailureReason.NotConnected);

    await kept.activateAsync(keptContext.fake);
    const restored = await callAsync(keptContext, "git-github.readSignIn");
    await kept.deactivateAsync();
    release(FakeGitHub.json({ message: "Bad credentials" }, 401));
    await waiting.activateAsync(waitingContext.fake);
    const following = waitingContext.fake.appWindows.activeCallsOf("onChanged").length;
    await waiting.deactivateAsync();

    assert.deepEqual([restored, keptContext.secrets.values.has("git-github.signIn")], [HostSignIn.signedIn(account).toJson(), true]);
    assert.deepEqual([following, waitingContext.fake.appWindows.activeCallsOf("onChanged").length], [2, 0]);
  });

  it("publishes git-github.access, which answers the held token with its login while signed in and why not otherwise, never logging the token", async () => {
    const github = new FakeGitHub();
    const release = github.hold();
    vi.stubGlobal("fetch", github.fetch);
    const signedIn = new RuntimeContext();
    signedIn.secrets.values.set("git-github.signIn", JSON.stringify({ token: "gho_token", account: account.toJson() }));
    const signedOut = new RuntimeContext();
    const parts = [new RuntimePart(), new RuntimePart()];

    await parts[0]?.activateAsync(signedIn.fake);
    await parts[1]?.activateAsync(signedOut.fake);
    const answers = await Promise.all([signedIn, signedOut].map(t => {
      const access = t.published("git-github.access");
      assert.ok(access instanceof GitHubAccess);
      return access.accessAsync(new AbortController().signal);
    }));
    for (const part of parts)
      await part.deactivateAsync();
    release(FakeGitHub.json({ message: "Bad credentials" }, 401));

    assert.deepEqual(answers, [new GitHubAccessGrant("gho_token", "octocat"), new GitHubAccessRefusal("Sign in to GitHub in Settings, GitHub.")]);
    assert.deepEqual([...signedIn.publishedNames(), ...signedOut.publishedNames()], ["git-github.access", "git-github.access"]);
    assert.ok([...linesOf(signedIn.fake.log), ...linesOf(signedOut.fake.log)].every(t => !t.includes("gho_token")));
  });

  it("serves the reads through its methods, signed out as no answer, and refuses a request that isn't the protocol's as InvalidParams", async () => {
    const github = new FakeGitHub();
    vi.stubGlobal("fetch", github.fetch);
    const part = new RuntimePart();
    const context = new RuntimeContext();

    await part.activateAsync(context.fake);
    const answers = [await callAsync(context, "git-github.readReference", new HostReference("git-github", "octocat", "hello-world", 1).toJson()),
      await callAsync(context, "git-github.readBranchPullRequest", new BranchQuery("github.com", "octocat/hello-world", "fix-bug", null).toJson()),
      await callAsync(context, "git-github.readAuthorAvatar", new AuthorQuery("github.com", "octocat/hello-world", "kim@example.com", "6dcb09b5b57875f334f61aebed695e2e4193db5e").toJson()),
      await callAsync(context, "git-github.readPullRequests", new RepositoryQuery("github.com", "octocat/hello-world").toJson()),
      await callAsync(context, "git-github.readReviewRequests", new RepositoryQuery("github.com", "octocat/hello-world").toJson()),
      await callAsync(context, "git-github.readCommitComments", new CommitQuery("github.com", "octocat/hello-world", "6dcb09b5b57875f334f61aebed695e2e4193db5e").toJson()),
      await callAsync(context, "git-github.readPullRequest", new HostReference("git-github", "octocat", "hello-world", 1).toJson()),
      await callAsync(context, "git-github.readPullRequestThreads", new HostReference("git-github", "octocat", "hello-world", 1).toJson()),
      await callAsync(context, "git-github.readCommitPullRequest", new CommitQuery("github.com", "octocat/hello-world", "6dcb09b5b57875f334f61aebed695e2e4193db5e").toJson())];
    const refusals = [await callAsync(context, "git-github.readReference", null).then(() => null, failureOf),
      await callAsync(context, "git-github.readBranchPullRequest", { host: "github.com" }).then(() => null, failureOf),
      await callAsync(context, "git-github.readAuthorAvatar", { host: "github.com" }).then(() => null, failureOf),
      await callAsync(context, "git-github.readPullRequests", { host: "github.com" }).then(() => null, failureOf),
      await callAsync(context, "git-github.readReviewRequests", { host: "github.com" }).then(() => null, failureOf),
      await callAsync(context, "git-github.readCommitComments", { host: "github.com" }).then(() => null, failureOf),
      await callAsync(context, "git-github.readPullRequest", null).then(() => null, failureOf),
      await callAsync(context, "git-github.readPullRequestThreads", { number: 1 }).then(() => null, failureOf),
      await callAsync(context, "git-github.readCommitPullRequest", { host: "github.com" }).then(() => null, failureOf),
      await callAsync(context, "git-github.readReference", { ...new HostReference("git-github", "octocat", "hello-world", 1).toJson(), title: "x" })
        .then(() => null, failureOf)];
    await part.deactivateAsync();

    assert.deepEqual([answers, github.requests.length], [[null, new BranchPullRequest(null, []).toJson(), { avatar: null },
      HostPullRequestList.signedOut().toJson(), HostReviewRequestList.signedOut().toJson(), HostCommitComments.none().toJson(), null, new HostPullRequestThreads([], false).toJson(), new BranchPullRequest(null, []).toJson()], 0]);
    assert.deepEqual(refusals.map(t => t?.[0]), Array.from({ length: 10 }, () => FailureCode.InvalidParams));
  });

  it("rethrows an error other than a malformed payload while it reads a request, rather than refusing it as InvalidParams", async () => {
    vi.stubGlobal("fetch", new FakeGitHub().fetch);
    const part = new RuntimePart();
    const context = new RuntimeContext();
    const unexpected = new RangeError("Unexpected.");
    vi.spyOn(HostReference, "fromJson").mockImplementation(() => {
      throw unexpected;
    });

    await part.activateAsync(context.fake);
    const failure: unknown = await callAsync(context, "git-github.readReference", new HostReference("git-github", "octocat", "hello-world", 1).toJson())
      .then(() => null, (error: unknown) => error);
    await part.deactivateAsync();

    assert.equal(failure, unexpected);
  });

  it("drops the answers it kept once the sign-in ends, so signing in again asks GitHub afresh", async () => {
    MockClock.use(1_800_000_000_000);
    const github = new FakeGitHub();
    const user = FakeGitHub.json({ login: "octocat", name: "The Octocat", avatar_url: null }, 200, { "X-OAuth-Scopes": "repo" });
    const issue = { number: 1, title: "Found a bug", state: "open", state_reason: null, html_url: "https://github.com/octocat/hello-world/issues/1",
      user: null, created_at: "2026-11-01T10:00:00Z", comments: 0 };
    github.answer(user, FakeGitHub.json(issue, 200, { ETag: "\"a\"" }), FakeGitHub.json(grant),
      FakeGitHub.json({ access_token: "gho_token", token_type: "bearer", scope: "repo" }), user.clone(), FakeGitHub.json(issue));
    vi.stubGlobal("fetch", github.fetch);
    const part = new RuntimePart();
    const context = new RuntimeContext();
    context.secrets.values.set("git-github.signIn", JSON.stringify({ token: "gho_token", account: account.toJson() }));
    const reference: JsonValue = new HostReference("git-github", "octocat", "hello-world", 1).toJson();

    await part.activateAsync(context.fake);
    await vi.advanceTimersByTimeAsync(0);
    await callAsync(context, "git-github.readReference", reference);
    await callAsync(context, "git-github.signOut");
    await callAsync(context, "git-github.startSignIn");
    await vi.advanceTimersByTimeAsync(5_000);
    const again = await callAsync(context, "git-github.readReference", reference);
    await part.deactivateAsync();

    assert.deepEqual([HostItem.fromJson(again).title, github.urls().at(-1), github.requests.at(-1)?.header("If-None-Match")],
      ["Found a bug", "https://api.github.com/repos/octocat/hello-world/issues/1", null]);
  });

  it("answers a window's reference with its author's avatar as a data address, read without the token, and never the avatar's address", async () => {
    MockClock.use(1_800_000_000_000);
    const github = new FakeGitHub();
    const png: Uint8Array<ArrayBuffer> = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const issue = { number: 1, title: "Found a bug", state: "closed", state_reason: "completed", html_url: "https://github.com/octocat/hello-world/issues/1",
      user: { login: "octocat", avatar_url: avatarUrl }, created_at: "2026-11-01T10:00:00Z", closed_at: "2026-11-02T09:30:00Z", comments: 0 };
    github.answer(FakeGitHub.json({ login: "octocat", name: "The Octocat", avatar_url: null }, 200, { "X-OAuth-Scopes": "repo" }),
      FakeGitHub.json(issue), new Response(new Blob([png]), { status: 200, headers: { "Content-Type": "image/png" } }));
    vi.stubGlobal("fetch", github.fetch);
    const part = new RuntimePart();
    const context = new RuntimeContext();
    context.secrets.values.set("git-github.signIn", JSON.stringify({ token: "gho_token", account: account.toJson() }));

    await part.activateAsync(context.fake);
    await vi.advanceTimersByTimeAsync(0);
    const answer = await callAsync(context, "git-github.readReference", new HostReference("git-github", "octocat", "hello-world", 1).toJson());
    await part.deactivateAsync();

    const item = HostItem.fromJson(answer);
    assert.deepEqual([item.author?.avatar, item.closedAt], [`data:image/png;base64,${Buffer.from(png).toString("base64")}`, Date.parse("2026-11-02T09:30:00Z")]);
    assert.deepEqual([github.urls().at(-1), github.requests.at(-1)?.header("Authorization")], ["https://avatars.githubusercontent.com/u/583231?s=64", null]);
    assert.ok(!JSON.stringify(answer).includes("avatars.githubusercontent.com"));
  });

  it("answers a pull request's comment threads as JSON that reads back the same", async () => {
    MockClock.use(1_800_000_000_000);
    const github = new FakeGitHub();
    const comment = { id: 7, user: { login: "octocat", avatar_url: avatarUrl, html_url: "https://github.com/octocat" }, created_at: "2026-11-01T10:00:00Z", body: "Looks good." };
    github.answer(FakeGitHub.json({ login: "octocat", name: "The Octocat", avatar_url: null }, 200, { "X-OAuth-Scopes": "repo" }),
      FakeGitHub.json({ comments: 1, review_comments: 0 }), FakeGitHub.json([comment]), FakeGitHub.json([]));
    vi.stubGlobal("fetch", github.fetch);
    const part = new RuntimePart();
    const context = new RuntimeContext();
    context.secrets.values.set("git-github.signIn", JSON.stringify({ token: "gho_token", account: account.toJson() }));

    await part.activateAsync(context.fake);
    await vi.advanceTimersByTimeAsync(0);
    const answer = await callAsync(context, "git-github.readPullRequestThreads", new HostReference("git-github", "octocat", "hello-world", 2).toJson());
    await part.deactivateAsync();

    assert.deepEqual(answer, new HostPullRequestThreads([new HostThread(14, ThreadStatus.None, null, null, [new HostComment(7, null,
      new HostPerson("octocat", null, "https://github.com/octocat"), Date.parse("2026-11-01T10:00:00Z"), "Looks good.")])], false).toJson());
  });

  it("opens a pull request only for the app's main process acting for a window, so only a person's click reaches GitHub", async () => {
    const github = new FakeGitHub();
    const pull = { number: 2, title: "Fix the bug", state: "open", draft: false, merged_at: null, html_url: "https://github.com/octocat/hello-world/pull/2",
      user: { login: "octocat", avatar_url: avatarUrl }, created_at: "2026-11-01T10:00:00Z", comments: 0, additions: 1, deletions: 0, changed_files: 1,
      head: { ref: "fix-bug", sha: "6dcb09b5b57875f334f61aebed695e2e4193db5e" }, base: { ref: "main" } };
    github.answer(FakeGitHub.json({ login: "octocat", name: "The Octocat", avatar_url: null }, 200, { "X-OAuth-Scopes": "repo" }),
      FakeGitHub.json(pull, 201));
    vi.stubGlobal("fetch", github.fetch);
    const part = new RuntimePart();
    const context = new RuntimeContext();
    context.secrets.values.set("git-github.signIn", JSON.stringify({ token: "gho_token", account: account.toJson() }));
    const draft: JsonValue = new PullRequestDraft("github.com", "octocat/hello-world", "fix-bug", "main", "Fix the bug", "", false).toJson();

    await part.activateAsync(context.fake);
    const refusals: (readonly string[] | null)[] = [];
    for (const [client, window] of [["cli", null], ["chat", 1], [ShellClients.mainProcess, null]] as const)
      refusals.push(await callAsync(context, "git-github.createPullRequest", draft, client, window).then(() => null, failureOf));
    const requestsBefore = github.requests.length;
    const made = await callAsync(context, "git-github.createPullRequest", draft, ShellClients.mainProcess, 1);
    await part.deactivateAsync();

    const refusal = [FailureCode.Unauthorized, "Only a person's click in a window opens a pull request."];
    assert.deepEqual([refusals, requestsBefore], [[refusal, refusal, refusal], 1]);
    assert.deepEqual([github.urls().at(-1), HostItem.fromJson(made).url],
      ["https://api.github.com/repos/octocat/hello-world/pulls", "https://github.com/octocat/hello-world/pull/2"]);
  });
});
