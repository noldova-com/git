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
import { MethodFailureException, RequestContext } from "@noldova/desktop.runtime";
import { AuthorQuery, BranchPullRequest, BranchQuery, CommitQuery, HostAccount, HostAvatar, HostCommitComments, HostPullRequestHeads, HostPullRequestList,
  HostReference, HostReviewRequestList, HostSignIn, HostWorkItem, HostWorkItemDetail, HostWorkItemType, PersonQuery, RepositoryQuery, SignInFailure,
  WorkItemCategory, WorkItemQuery, WorkItemScope, WorkItemsQuery, WorkItemUpdate } from "@noldova/git.hosting.protocol";
import { afterEach, describe, it, vi } from "vitest";

import { RuntimePart } from "../src/api/index.ts";
import { FakeAzure, KeptSecrets, linesOf } from "./fixtures/fake-azure.fixture.ts";
import { RuntimeContext } from "./fixtures/runtime-context.fixture.ts";

const account: HostAccount = new HostAccount("monalisa@fabrikam.test", "Mona Lisa", null, []);
const profile = (): Response => FakeAzure.json({ authenticatedUser: { providerDisplayName: "Mona Lisa", properties: { Account: { $value: "monalisa@fabrikam.test" } } } });
const reference: JsonValue = new HostReference("git-azure-devops", "fabrikam", "3411ebc1-d5aa-464f-9615-0b527bc66719", 12).toJson();
const bugItem: JsonValue = { id: 42, fields: { "System.TeamProject": "web", "System.WorkItemType": "Bug", "System.Title": "Fix the sign-in", "System.State": "New" } };
const bugType = (): Response => FakeAzure.json({ name: "Bug", color: "CC293D", icon: { id: "icon_insect" }, states: [{ name: "New", category: "Proposed" }] });
const noIcon = (): Response => new Response(null, { status: 404 });
const bugDetail: HostWorkItemDetail = new HostWorkItemDetail(new HostWorkItem("git-azure-devops", "fabrikam", "web", 42, new HostWorkItemType("Bug", "CC293D",
  "icon_insect"), "Fix the sign-in", "New", WorkItemCategory.Proposed, "https://dev.azure.com/fabrikam/web/_workitems/edit/42", null, null, null, null), null, null,
null, null, null, [], [], 0, []);

async function callAsync(context: RuntimeContext, name: string, payload: JsonValue = null, client: string = "git-azure-devops",
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
  });

  it("is active from its activation until its deactivation", async () => {
    vi.stubGlobal("fetch", new FakeAzure().fetch);
    const part: RuntimePart = new RuntimePart();
    const context: RuntimeContext = new RuntimeContext();

    const states: boolean[] = [part.isActive];
    await part.activateAsync(context.fake);
    states.push(part.isActive);
    await part.deactivateAsync();
    states.push(part.isActive);
    await part.deactivateAsync();

    assert.deepEqual(states, [false, true, false]);
  });

  it("signs in with a window's token for its organization through the global fetch, signs out, and publishes each change on its event", async () => {
    const azure = new FakeAzure();
    azure.answer(profile());
    vi.stubGlobal("fetch", azure.fetch);
    const part = new RuntimePart();
    const context = new RuntimeContext();

    await part.activateAsync(context.fake);
    const answers = [await callAsync(context, "git-azure-devops.readSignIn"),
      await callAsync(context, "git-azure-devops.signInWithToken", { token: "azure-token", organization: "fabrikam" }, ShellClients.mainProcess, 1),
      await callAsync(context, "git-azure-devops.signOut")];
    await part.deactivateAsync();

    assert.deepEqual(azure.urls(), ["https://dev.azure.com/fabrikam/_apis/connectionData"]);
    assert.deepEqual([...context.methods.keys()], ["git-azure-devops.readSignIn", "git-azure-devops.startSignIn", "git-azure-devops.cancelSignIn",
      "git-azure-devops.signInWithToken", "git-azure-devops.signOut",
      "git-azure-devops.readReference", "git-azure-devops.readPullRequest", "git-azure-devops.readBranchPullRequest", "git-azure-devops.readWorkItem",
      "git-azure-devops.readWorkItems", "git-azure-devops.updateWorkItem",
      "git-azure-devops.readAuthorAvatar", "git-azure-devops.readPersonAvatar", "git-azure-devops.readPullRequests", "git-azure-devops.readPullRequestHeads",
      "git-azure-devops.readReviewRequests", "git-azure-devops.readCommitComments", "git-azure-devops.readPullRequestThreads",
      "git-azure-devops.readPullRequestCommits", "git-azure-devops.readPullRequestUpdates", "git-azure-devops.readPullRequestChanges",
      "git-azure-devops.readPullRequestConflicts", "git-azure-devops.linkBranch",
      "git-azure-devops.replyToThread", "git-azure-devops.changeThread",
      "git-azure-devops.vote", "git-azure-devops.readMergeTypes", "git-azure-devops.completePullRequest",
      "git-azure-devops.setAutoComplete", "git-azure-devops.cancelAutoComplete", "git-azure-devops.abandonPullRequest",
      "git-azure-devops.searchPeople", "git-azure-devops.readCommitPullRequest",
      "git-azure-devops.addReviewer"]);
    assert.deepEqual(answers, [HostSignIn.signedOut().toJson(), HostSignIn.signedIn(account).toJson(), HostSignIn.signedOut().toJson()]);
    assert.deepEqual([context.events.get("git-azure-devops.signInChanged"), context.secrets.values.size],
      [[HostSignIn.signedIn(account).toJson(), HostSignIn.signedOut().toJson()], 0]);
    assert.ok(!linesOf(context.fake.log).some(t => t.includes("azure-token")));
  });

  it("starts a sign-in with Microsoft only from the app's main process acting for a window, for an organization's name, and cancels it", async () => {
    const azure = new FakeAzure();
    vi.stubGlobal("fetch", azure.fetch);
    const part = new RuntimePart();
    const context = new RuntimeContext();

    await part.activateAsync(context.fake);
    const refusals: (readonly string[] | null)[] = [];
    for (const [client, window] of [["cli", null], ["chat", 1], [ShellClients.mainProcess, null]] as const)
      refusals.push(await callAsync(context, "git-azure-devops.startSignIn", { organization: "fabrikam" }, client, window).then(() => null, failureOf));
    for (const payload of [null, { organization: 42 }, { organization: "fab/rikam" }, { organization: "" }])
      refusals.push(await callAsync(context, "git-azure-devops.startSignIn", payload, ShellClients.mainProcess, 1).then(() => null, failureOf));
    const waiting = HostSignIn.fromJson(await callAsync(context, "git-azure-devops.startSignIn", { organization: "fabrikam" }, ShellClients.mainProcess, 1));
    const cancelled = await callAsync(context, "git-azure-devops.cancelSignIn");
    await part.deactivateAsync();

    const unauthorized = [FailureCode.Unauthorized, "Only a person's sign-in in a window signs in to Azure DevOps."];
    const invalid = [FailureCode.InvalidParams, "The sign-in with Microsoft takes an organization's name, as { organization }."];
    assert.deepEqual([refusals, azure.requests.length], [[unauthorized, unauthorized, unauthorized, invalid, invalid, invalid, invalid], 0]);
    assert.deepEqual([waiting.state, waiting.address?.startsWith("https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize?"), cancelled],
      ["Waiting", true, HostSignIn.signedOut().toJson()]);
  });

  it("takes a token only from the app's main process acting for a window, and refuses a payload without one or a valid organization without repeating it", async () => {
    const azure = new FakeAzure();
    vi.stubGlobal("fetch", azure.fetch);
    const part = new RuntimePart();
    const context = new RuntimeContext();

    await part.activateAsync(context.fake);
    const refusals: (readonly string[] | null)[] = [];
    for (const [client, window] of [["cli", null], ["chat", 1], [ShellClients.mainProcess, null]] as const)
      refusals.push(await callAsync(context, "git-azure-devops.signInWithToken", { token: "azure-token", organization: "fabrikam" }, client, window).then(() => null, failureOf));
    for (const payload of [null, { token: " ", organization: "fabrikam" }, { token: 42, organization: "fabrikam" }, { token: "azure-token" },
      { token: "azure-token", organization: "fab/rikam" }, { token: "azure-token", organization: "" }])
      refusals.push(await callAsync(context, "git-azure-devops.signInWithToken", payload, ShellClients.mainProcess, 1).then(() => null, failureOf));
    await part.deactivateAsync();

    const unauthorized = [FailureCode.Unauthorized, "Only a person's sign-in in a window signs in to Azure DevOps."];
    const invalid = [FailureCode.InvalidParams, "The sign-in takes a token that isn't blank and an organization's name, as { token, organization }."];
    assert.deepEqual([refusals, azure.requests.length], [[unauthorized, unauthorized, unauthorized, invalid, invalid, invalid, invalid, invalid, invalid], 0]);
  });

  it("restores the kept sign-in on activation, and stops following the app's windows on deactivation", async () => {
    const azure = new FakeAzure();
    azure.hold();
    vi.stubGlobal("fetch", azure.fetch);
    const kept = new RuntimePart();
    const keptContext = new RuntimeContext();
    keptContext.secrets.values.set("git-azure-devops.signIn", JSON.stringify({ token: "kept-token", organization: "fabrikam", account: account.toJson() }));
    const waiting = new RuntimePart();
    const waitingContext = new RuntimeContext();
    waitingContext.secrets.readFailure = KeptSecrets.failure(SecretFailureReason.NotConnected);

    await kept.activateAsync(keptContext.fake);
    const restored = await callAsync(keptContext, "git-azure-devops.readSignIn");
    await kept.deactivateAsync();
    await waiting.activateAsync(waitingContext.fake);
    const following = waitingContext.fake.appWindows.activeCallsOf("onChanged").length;
    await waiting.deactivateAsync();

    assert.deepEqual([restored, keptContext.secrets.values.has("git-azure-devops.signIn")], [HostSignIn.signedIn(account).toJson(), true]);
    assert.deepEqual([following, waitingContext.fake.appWindows.activeCallsOf("onChanged").length], [1, 0]);
  });

  it("serves the reads through its methods, signed out as no answer, and refuses a request that isn't the protocol's as InvalidParams", async () => {
    const azure = new FakeAzure();
    vi.stubGlobal("fetch", azure.fetch);
    const part = new RuntimePart();
    const context = new RuntimeContext();

    await part.activateAsync(context.fake);
    const answers = [await callAsync(context, "git-azure-devops.readReference", reference),
      await callAsync(context, "git-azure-devops.readPullRequest", reference),
      await callAsync(context, "git-azure-devops.readBranchPullRequest", new BranchQuery("dev.azure.com", "fabrikam/web/_git/site", "main", null).toJson()),
      await callAsync(context, "git-azure-devops.readWorkItem", new WorkItemQuery("git-azure-devops", "fabrikam", 42).toJson()),
      await callAsync(context, "git-azure-devops.readAuthorAvatar", new AuthorQuery("dev.azure.com", "fabrikam", "monalisa@fabrikam.test", "a".repeat(40)).toJson()),
      await callAsync(context, "git-azure-devops.readPersonAvatar", new PersonQuery("dev.azure.com", "fabrikam", "monalisa@fabrikam.test").toJson()),
      await callAsync(context, "git-azure-devops.readPullRequests", new RepositoryQuery("dev.azure.com", "fabrikam/web/_git/site").toJson()),
      await callAsync(context, "git-azure-devops.readPullRequestHeads", new RepositoryQuery("dev.azure.com", "fabrikam/web/_git/site").toJson()),
      await callAsync(context, "git-azure-devops.readReviewRequests", new RepositoryQuery("dev.azure.com", "fabrikam/web/_git/site").toJson()),
      await callAsync(context, "git-azure-devops.readCommitComments", new CommitQuery("dev.azure.com", "fabrikam/web/_git/site", "a".repeat(40)).toJson()),
      await callAsync(context, "git-azure-devops.readPullRequestThreads", reference),
      await callAsync(context, "git-azure-devops.readPullRequestCommits", reference), await callAsync(context, "git-azure-devops.readPullRequestUpdates", reference),
      await callAsync(context, "git-azure-devops.readPullRequestChanges", reference), await callAsync(context, "git-azure-devops.readPullRequestConflicts", reference),
      await callAsync(context, "git-azure-devops.readCommitPullRequest", new CommitQuery("dev.azure.com", "fabrikam/web/_git/site", "a".repeat(40)).toJson())];
    const refusals = [await callAsync(context, "git-azure-devops.readReference", null).then(() => null, failureOf),
      await callAsync(context, "git-azure-devops.readPullRequest", { host: "git-azure-devops" }).then(() => null, failureOf),
      await callAsync(context, "git-azure-devops.readBranchPullRequest", { host: "dev.azure.com" }).then(() => null, failureOf),
      await callAsync(context, "git-azure-devops.readWorkItem", { host: "git-azure-devops", organization: "fabrikam", id: 0 }).then(() => null, failureOf),
      await callAsync(context, "git-azure-devops.readAuthorAvatar", { host: "dev.azure.com", path: "fabrikam" }).then(() => null, failureOf),
      await callAsync(context, "git-azure-devops.readPersonAvatar", { host: "dev.azure.com", path: "fabrikam", login: " " }).then(() => null, failureOf),
      await callAsync(context, "git-azure-devops.readPullRequests", { host: "dev.azure.com" }).then(() => null, failureOf),
      await callAsync(context, "git-azure-devops.readPullRequestHeads", { host: "dev.azure.com" }).then(() => null, failureOf),
      await callAsync(context, "git-azure-devops.readReviewRequests", { host: "dev.azure.com" }).then(() => null, failureOf),
      await callAsync(context, "git-azure-devops.readCommitComments", { host: "dev.azure.com", path: "fabrikam/web/_git/site", commit: "a" }).then(() => null, failureOf),
      await callAsync(context, "git-azure-devops.readPullRequestThreads", { host: "git-azure-devops" }).then(() => null, failureOf),
      await callAsync(context, "git-azure-devops.readPullRequestCommits", { host: "git-azure-devops" }).then(() => null, failureOf),
      await callAsync(context, "git-azure-devops.readPullRequestUpdates", { host: "git-azure-devops" }).then(() => null, failureOf),
      await callAsync(context, "git-azure-devops.readPullRequestChanges", { host: "git-azure-devops" }).then(() => null, failureOf),
      await callAsync(context, "git-azure-devops.readPullRequestConflicts", { host: "git-azure-devops" }).then(() => null, failureOf),
      await callAsync(context, "git-azure-devops.readCommitPullRequest", { host: "dev.azure.com", path: "fabrikam/web/_git/site", commit: "a" }).then(() => null, failureOf)];
    await part.deactivateAsync();

    assert.deepEqual([answers, azure.requests.length], [[null, null, new BranchPullRequest(null, []).toJson(), null,
      new HostAvatar(null).toJson(), new HostAvatar(null).toJson(),
      HostPullRequestList.signedOut().toJson(), HostPullRequestHeads.signedOut().toJson(), HostReviewRequestList.signedOut().toJson(), HostCommitComments.none().toJson(),
      { threads: [], hasMore: false },
      { commits: [], hasMore: false }, { updates: [], hasMore: false }, { sourceCommit: null, commonCommit: null, files: [], hasMore: false },
      { paths: [], hasMore: false }, new BranchPullRequest(null, []).toJson()], 0]);
    assert.deepEqual(refusals.map(t => t?.[0]), Array.from({ length: 16 }, () => FailureCode.InvalidParams));
  });

  it("serves a signed-in pull request's threads as their JSON, with no more", async () => {
    const azure = new FakeAzure();
    azure.hold();
    azure.answer(FakeAzure.json({ count: 1, value: [{ id: 3, status: "active", comments: [{ id: 1, parentCommentId: 0, author: { uniqueName: "monalisa@fabrikam.test" },
      content: "Fix the sign-in", publishedDate: "2027-05-02T00:00:00Z", commentType: "text" }] }] }));
    vi.stubGlobal("fetch", azure.fetch);
    const part = new RuntimePart();
    const context = new RuntimeContext();
    context.secrets.values.set("git-azure-devops.signIn", JSON.stringify({ token: "kept-token", organization: "fabrikam", account: account.toJson() }));

    await part.activateAsync(context.fake);
    const answers = [await callAsync(context, "git-azure-devops.readPullRequestThreads", reference)];
    await part.deactivateAsync();

    assert.deepEqual(answers, [{ threads: [{ id: 3, state: "Active", path: null, line: null, comments: [{ id: 1, parent: null, author: { login: "monalisa@fabrikam.test", avatar: null,
      url: null }, publishedAt: Date.parse("2027-05-02T00:00:00Z"), body: "Fix the sign-in" }] }], hasMore: false }]);
  });

  it("serves a signed-in work item read through its method as the item's JSON", async () => {
    const azure = new FakeAzure();
    azure.hold();
    azure.answer(FakeAzure.json({ id: 42, fields: { "System.TeamProject": "web", "System.WorkItemType": "Bug", "System.Title": "Fix the sign-in",
      "System.State": "New" } }), FakeAzure.json({ name: "Bug", color: "CC293D", icon: { id: "icon_insect" }, states: [{ name: "New", category: "Proposed" }] }), noIcon());
    vi.stubGlobal("fetch", azure.fetch);
    const part = new RuntimePart();
    const context = new RuntimeContext();
    context.secrets.values.set("git-azure-devops.signIn", JSON.stringify({ token: "kept-token", organization: "fabrikam", account: account.toJson() }));

    await part.activateAsync(context.fake);
    const answer = await callAsync(context, "git-azure-devops.readWorkItem", new WorkItemQuery("git-azure-devops", "fabrikam", 42).toJson());
    await part.deactivateAsync();

    assert.deepEqual(answer, new HostWorkItem("git-azure-devops", "fabrikam", "web", 42, new HostWorkItemType("Bug", "CC293D", "icon_insect"),
      "Fix the sign-in", "New", WorkItemCategory.Proposed, "https://dev.azure.com/fabrikam/web/_workitems/edit/42", null, null, null, null).toJson());
  });

  it("rethrows an error other than a malformed payload while it reads a request, rather than refusing it as InvalidParams", async () => {
    vi.stubGlobal("fetch", new FakeAzure().fetch);
    const part = new RuntimePart();
    const context = new RuntimeContext();
    const unexpected = new RangeError("Unexpected.");
    vi.spyOn(HostReference, "fromJson").mockImplementation(() => {
      throw unexpected;
    });

    await part.activateAsync(context.fake);
    const failure: unknown = await callAsync(context, "git-azure-devops.readReference", reference).then(() => null, (error: unknown) => error);
    await part.deactivateAsync();

    assert.equal(failure, unexpected);
  });

  it("answers a refused token as signed out with Refused, keeping nothing", async () => {
    const azure = new FakeAzure();
    azure.answer(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", azure.fetch);
    const part = new RuntimePart();
    const context = new RuntimeContext();

    await part.activateAsync(context.fake);
    const answer = await callAsync(context, "git-azure-devops.signInWithToken", { token: "azure-token", organization: "fabrikam" }, ShellClients.mainProcess, 1);
    await part.deactivateAsync();

    assert.deepEqual([answer, context.secrets.values.size], [HostSignIn.signedOut(SignInFailure.Refused).toJson(), 0]);
  });

  it("links a branch only for the app's main process acting for a window, with a payload it can read, and answers null", async () => {
    const azure = new FakeAzure();
    azure.hold();
    azure.answer(FakeAzure.json({ id: "3411ebc1-d5aa-464f-9615-0b527bc66719", project: { id: "6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c" } }), FakeAzure.json({ id: 42 }));
    vi.stubGlobal("fetch", azure.fetch);
    const part = new RuntimePart();
    const context = new RuntimeContext();
    context.secrets.values.set("git-azure-devops.signIn", JSON.stringify({ token: "kept-token", organization: "fabrikam", account: account.toJson() }));
    const link = { host: "dev.azure.com", path: "fabrikam/web/_git/site", id: 42, branch: "42-sign-in" };

    await part.activateAsync(context.fake);
    const refusals: (readonly string[] | null)[] = [];
    for (const [client, window] of [["cli", null], ["chat", 1], [ShellClients.mainProcess, null]] as const)
      refusals.push(await callAsync(context, "git-azure-devops.linkBranch", link, client, window).then(() => null, failureOf));
    for (const payload of [null, { ...link, host: "github.com" }, { ...link, branch: " " }])
      refusals.push(await callAsync(context, "git-azure-devops.linkBranch", payload, ShellClients.mainProcess, 1).then(() => null, failureOf));
    const answer = await callAsync(context, "git-azure-devops.linkBranch", link, ShellClients.mainProcess, 1);
    await part.deactivateAsync();

    const unauthorized = [FailureCode.Unauthorized, "Only a person's sign-in in a window signs in to Azure DevOps."];
    const invalid = [FailureCode.InvalidParams,
      "The branch link takes { host, path, id, branch }: an Azure DevOps remote's host and path, a work item's id and a branch's name."];
    assert.deepEqual([refusals, answer, azure.urls().slice(1)], [[unauthorized, unauthorized, unauthorized, invalid, invalid, invalid], null,
      ["https://dev.azure.com/fabrikam/web/_apis/git/repositories/site?api-version=7.1", "https://dev.azure.com/fabrikam/_apis/wit/workitems/42?api-version=7.1"]]);
  });

  it("serves a signed-in work items read through its method as a list of their details and whether the search stopped at its limit, and refuses a query that isn't the protocol's", async () => {
    const azure = new FakeAzure();
    azure.hold();
    azure.answer(FakeAzure.json({ count: 1, value: [bugItem] }), bugType(), noIcon());
    vi.stubGlobal("fetch", azure.fetch);
    const part = new RuntimePart();
    const context = new RuntimeContext();
    context.secrets.values.set("git-azure-devops.signIn", JSON.stringify({ token: "kept-token", organization: "fabrikam", account: account.toJson() }));
    const query: JsonValue = new WorkItemsQuery("git-azure-devops", "fabrikam", "web", WorkItemScope.Ids, [42]).toJson();

    await part.activateAsync(context.fake);
    const answer = await callAsync(context, "git-azure-devops.readWorkItems", query);
    const refused = await callAsync(context, "git-azure-devops.readWorkItems", { scope: "Mine" }).then(() => null, failureOf);
    await part.deactivateAsync();

    assert.deepEqual([answer, refused?.[0]], [{ items: [bugDetail.toJson()], isTruncated: false }, FailureCode.InvalidParams]);
  });

  it("updates a work item only for the app's main process acting for a window, with a payload it can read, and answers its detail", async () => {
    const azure = new FakeAzure();
    azure.hold();
    azure.answer(FakeAzure.json(bugItem), bugType(), noIcon());
    vi.stubGlobal("fetch", azure.fetch);
    const part = new RuntimePart();
    const context = new RuntimeContext();
    context.secrets.values.set("git-azure-devops.signIn", JSON.stringify({ token: "kept-token", organization: "fabrikam", account: account.toJson() }));
    const update: JsonValue = new WorkItemUpdate("git-azure-devops", "fabrikam", 42, "New", false).toJson();

    await part.activateAsync(context.fake);
    const refusals: (string | null)[] = [];
    for (const [client, window] of [["cli", null], ["chat", 1], [ShellClients.mainProcess, null]] as const)
      refusals.push((await callAsync(context, "git-azure-devops.updateWorkItem", update, client, window).then(() => null, failureOf))?.[0] ?? null);
    refusals.push((await callAsync(context, "git-azure-devops.updateWorkItem", { id: 42 }, ShellClients.mainProcess, 1).then(() => null, failureOf))?.[0] ?? null);
    const answer = await callAsync(context, "git-azure-devops.updateWorkItem", update, ShellClients.mainProcess, 1);
    await part.deactivateAsync();

    assert.deepEqual([refusals, answer, azure.urls().slice(1)], [[FailureCode.Unauthorized, FailureCode.Unauthorized, FailureCode.Unauthorized,
      FailureCode.InvalidParams], bugDetail.toJson(), ["https://dev.azure.com/fabrikam/_apis/wit/workitems/42?$expand=relations&api-version=7.1",
      "https://dev.azure.com/fabrikam/web/_apis/wit/workitemtypes/Bug?api-version=7.1", "https://dev.azure.com/fabrikam/_apis/wit/workitemicons/icon_insect?color=CC293D&v=2&api-version=7.1"]]);
  });

  it("replies to a thread and changes its state only for the app's main process acting for a window, with a payload it can read", async () => {
    const azure = new FakeAzure();
    azure.hold();
    azure.answer(FakeAzure.json({ id: 2, parentCommentId: 1, author: { uniqueName: "monalisa@fabrikam.test" }, content: "Fixed.",
      publishedDate: "2027-05-02T00:00:00Z", commentType: "text" }), FakeAzure.json({ id: 3, status: "fixed" }));
    vi.stubGlobal("fetch", azure.fetch);
    const part = new RuntimePart();
    const context = new RuntimeContext();
    context.secrets.values.set("git-azure-devops.signIn", JSON.stringify({ token: "kept-token", organization: "fabrikam", account: account.toJson() }));
    const reply = { reference, thread: 3, parent: 1, body: "Fixed." };
    const change = { reference, thread: 3, state: "Resolved" };

    await part.activateAsync(context.fake);
    const refusals: (readonly string[] | null)[] = [];
    for (const [client, window] of [["cli", null], ["chat", 1], [ShellClients.mainProcess, null]] as const) {
      refusals.push(await callAsync(context, "git-azure-devops.replyToThread", reply, client, window).then(() => null, failureOf));
      refusals.push(await callAsync(context, "git-azure-devops.changeThread", change, client, window).then(() => null, failureOf));
    }
    for (const payload of [null, { ...reply, body: " " }, { ...reply, parent: 0 }, { ...reply, body: "x".repeat(150_001) }])
      refusals.push(await callAsync(context, "git-azure-devops.replyToThread", payload, ShellClients.mainProcess, 1).then(() => null, failureOf));
    for (const payload of [{ ...change, state: "Closed" }, { ...change, thread: 0 }, { ...change, reference: { ...change.reference, host: "git-github" } }])
      refusals.push(await callAsync(context, "git-azure-devops.changeThread", payload, ShellClients.mainProcess, 1).then(() => null, failureOf));
    const answers = [await callAsync(context, "git-azure-devops.replyToThread", { ...reply, body: "x".repeat(150_000) }, ShellClients.mainProcess, 1),
      await callAsync(context, "git-azure-devops.changeThread", change, ShellClients.mainProcess, 1)];
    await part.deactivateAsync();

    const unauthorized = [FailureCode.Unauthorized, "Only a person's sign-in in a window signs in to Azure DevOps."];
    const badReply = [FailureCode.InvalidParams, "The reply takes { reference, thread, parent, body }: an Azure DevOps pull request's reference, a thread's id, "
      + "the id of the comment it answers and a text that isn't blank, at most 150,000 characters."];
    const badChange = [FailureCode.InvalidParams, "The thread change takes { reference, thread, state }: an Azure DevOps pull request's reference, "
      + "a thread's id and Active or Resolved."];
    assert.deepEqual(refusals, [...Array.from({ length: 6 }, () => unauthorized), badReply, badReply, badReply, badReply, badChange, badChange, badChange]);
    assert.deepEqual(answers, [{ id: 2, parent: 1, author: { login: "monalisa@fabrikam.test", avatar: null, url: null }, publishedAt: Date.parse("2027-05-02T00:00:00Z"),
      body: "Fixed." }, null]);
    assert.deepEqual(azure.urls().slice(1), [
      "https://dev.azure.com/fabrikam/_apis/git/repositories/3411ebc1-d5aa-464f-9615-0b527bc66719/pullRequests/12/threads/3/comments?api-version=7.1",
      "https://dev.azure.com/fabrikam/_apis/git/repositories/3411ebc1-d5aa-464f-9615-0b527bc66719/pullRequests/12/threads/3?api-version=7.1"]);
  });

  it("reads the merge types, and completes only for the app's main process acting for a window, with a completion Azure DevOps takes", async () => {
    const commit: string = "9f2c4e1a7b3d5f6081c2e4a6b8d0f1e3a5c7b9d1";
    const pull = (): Response => FakeAzure.json({ status: "active", isDraft: false, mergeStatus: "succeeded", targetRefName: "refs/heads/main",
      lastMergeSourceCommit: { commitId: commit }, repository: { project: { id: "6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c" } } });
    const limit = (): Response => FakeAzure.json({ value: [{ configuration: { isBlocking: true, type: { id: "fa4e907d-c16b-4a4c-9dfa-4916e5d171ab" },
      settings: { allowSquash: true, allowRebase: true } } }] });
    const azure = new FakeAzure();
    azure.hold();
    azure.answer(pull(), limit(), pull(), limit(), FakeAzure.json({ status: "completed" }));
    vi.stubGlobal("fetch", azure.fetch);
    const part = new RuntimePart();
    const context = new RuntimeContext();
    context.secrets.values.set("git-azure-devops.signIn", JSON.stringify({ token: "kept-token", organization: "fabrikam", account: account.toJson() }));
    const completion = { reference, sourceCommit: commit, targetBranch: "main", mergeType: "squash", message: "Merged PR 12: Fold tag case", completeWorkItems: true,
      deleteSourceBranch: true };

    await part.activateAsync(context.fake);
    const types = await callAsync(context, "git-azure-devops.readMergeTypes", reference);
    const refusals: (readonly string[] | null)[] = [await callAsync(context, "git-azure-devops.readMergeTypes", null).then(() => null, failureOf)];
    for (const [client, window] of [["cli", null], ["chat", 1], [ShellClients.mainProcess, null]] as const)
      refusals.push(await callAsync(context, "git-azure-devops.completePullRequest", completion, client, window).then(() => null, failureOf));
    for (const payload of [null, { ...completion, mergeType: "fastForward" }])
      refusals.push(await callAsync(context, "git-azure-devops.completePullRequest", payload, ShellClients.mainProcess, 1).then(() => null, failureOf));
    const answer = await callAsync(context, "git-azure-devops.completePullRequest", completion, ShellClients.mainProcess, 1);
    await part.deactivateAsync();

    const unauthorized = [FailureCode.Unauthorized, "Only a person's sign-in in a window signs in to Azure DevOps."];
    const badCompletion = [FailureCode.InvalidParams, "Completing takes { reference, sourceCommit, targetBranch, mergeType, message, completeWorkItems, deleteSourceBranch }: "
      + "an Azure DevOps pull request's reference, its last merge source commit's 40-character id, its target branch, noFastForward, squash, rebase or rebaseMerge, "
      + "a merge commit message that isn't blank, at most 4,000 characters, or null for rebase alone, and two booleans."];
    assert.deepEqual([types, refusals[0]?.[0], refusals.slice(1)], [["squash", "rebase"], FailureCode.InvalidParams,
      [unauthorized, unauthorized, unauthorized, badCompletion, badCompletion]]);
    assert.deepEqual([answer, azure.requests.at(-1)?.init.method, azure.requests.at(-1)?.body], [null, "PATCH", { status: "completed",
      lastMergeSourceCommit: { commitId: commit }, completionOptions: { mergeStrategy: "squash", mergeCommitMessage: "Merged PR 12: Fold tag case", transitionWorkItems: true,
        deleteSourceBranch: true } }]);
    assert.deepEqual(azure.urls().slice(1).filter((_, i) => i % 2 === 0), Array(3).fill(
      "https://dev.azure.com/fabrikam/_apis/git/repositories/3411ebc1-d5aa-464f-9615-0b527bc66719/pullrequests/12?api-version=7.1"));
  });

  it("sets and cancels auto-complete and abandons only for the app's main process acting for a window, with a payload Azure DevOps takes", async () => {
    const commit: string = "9f2c4e1a7b3d5f6081c2e4a6b8d0f1e3a5c7b9d1";
    const pull = (): Response => FakeAzure.json({ status: "active", isDraft: false, targetRefName: "refs/heads/main", lastMergeSourceCommit: { commitId: commit },
      repository: { project: { id: "6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c" } } });
    const azure = new FakeAzure();
    azure.hold();
    azure.answer(pull(), FakeAzure.json({ value: [] }), FakeAzure.json({ authenticatedUser: { id: "d6245f20-2af8-44f4-9451-8107cb2767db" } }),
      FakeAzure.json({ status: "active" }), pull(), FakeAzure.json({ status: "active" }), pull(), FakeAzure.json({ status: "abandoned" }));
    vi.stubGlobal("fetch", azure.fetch);
    const part = new RuntimePart();
    const context = new RuntimeContext();
    context.secrets.values.set("git-azure-devops.signIn", JSON.stringify({ token: "kept-token", organization: "fabrikam", account: account.toJson() }));
    const completion = { reference, sourceCommit: commit, targetBranch: "main", mergeType: "squash", message: "Merged PR 12: Fold tag case", completeWorkItems: true,
      deleteSourceBranch: true };
    const writes = [["git-azure-devops.setAutoComplete", completion], ["git-azure-devops.cancelAutoComplete", reference],
      ["git-azure-devops.abandonPullRequest", { reference, sourceCommit: commit }]] as const;

    await part.activateAsync(context.fake);
    const refusals: (readonly string[] | null)[] = [];
    for (const [method, payload] of writes)
      for (const [client, window] of [["cli", null], ["chat", 1], [ShellClients.mainProcess, null]] as const)
        refusals.push(await callAsync(context, method, payload, client, window).then(() => null, failureOf));
    for (const [method, payload] of [["git-azure-devops.setAutoComplete", { ...completion, message: null }],
      ["git-azure-devops.cancelAutoComplete", new HostReference("git-github", "octocat", "hello-world", 12).toJson()], ["git-azure-devops.abandonPullRequest", { reference, sourceCommit: "1" }]] as const)
      refusals.push(await callAsync(context, method, payload, ShellClients.mainProcess, 1).then(() => null, failureOf));
    const answers: unknown[] = [];
    for (const [method, payload] of writes)
      answers.push(await callAsync(context, method, payload, ShellClients.mainProcess, 1));
    await part.deactivateAsync();

    const unauthorized = [FailureCode.Unauthorized, "Only a person's sign-in in a window signs in to Azure DevOps."];
    assert.deepEqual(refusals.slice(0, 9), Array(9).fill(unauthorized));
    assert.deepEqual(refusals.slice(9).map(t => t?.[0]), Array(3).fill(FailureCode.InvalidParams));
    assert.deepEqual(refusals.slice(10).map(t => t?.[1]), ["It takes an Azure DevOps pull request's reference.",
      "Abandoning takes { reference, sourceCommit }: an Azure DevOps pull request's reference and its last merge source commit's 40-character id."]);
    assert.deepEqual([answers, azure.requests.filter(t => t.init.method === "PATCH").map(t => t.body)], [[null, null, null], [
      { autoCompleteSetBy: { id: "d6245f20-2af8-44f4-9451-8107cb2767db" }, completionOptions: { mergeStrategy: "squash", mergeCommitMessage: "Merged PR 12: Fold tag case",
        transitionWorkItems: true, deleteSourceBranch: true } },
      { autoCompleteSetBy: { id: "00000000-0000-0000-0000-000000000000" } }, { status: "abandoned" }]]);
  });

  it("votes only for the app's main process acting for a window, with a vote Azure DevOps takes", async () => {
    const azure = new FakeAzure();
    azure.hold();
    azure.answer(FakeAzure.json({ authenticatedUser: { id: "d6245f20-2af8-44f4-9451-8107cb2767db" } }),
      FakeAzure.json({ uniqueName: "monalisa@fabrikam.test", vote: 5 }));
    vi.stubGlobal("fetch", azure.fetch);
    const part = new RuntimePart();
    const context = new RuntimeContext();
    context.secrets.values.set("git-azure-devops.signIn", JSON.stringify({ token: "kept-token", organization: "fabrikam", account: account.toJson() }));
    const vote = { reference, vote: 5 };

    await part.activateAsync(context.fake);
    const refusals: (readonly string[] | null)[] = [];
    for (const [client, window] of [["cli", null], ["chat", 1], [ShellClients.mainProcess, null]] as const)
      refusals.push(await callAsync(context, "git-azure-devops.vote", vote, client, window).then(() => null, failureOf));
    for (const payload of [null, { ...vote, vote: 7 }])
      refusals.push(await callAsync(context, "git-azure-devops.vote", payload, ShellClients.mainProcess, 1).then(() => null, failureOf));
    const answer = await callAsync(context, "git-azure-devops.vote", vote, ShellClients.mainProcess, 1);
    await part.deactivateAsync();

    const unauthorized = [FailureCode.Unauthorized, "Only a person's sign-in in a window signs in to Azure DevOps."];
    const badVote = [FailureCode.InvalidParams, "The vote takes { reference, vote }: an Azure DevOps pull request's reference and 10, 5, 0, -5 or -10."];
    assert.deepEqual(refusals, [unauthorized, unauthorized, unauthorized, badVote, badVote]);
    assert.deepEqual(answer, { person: { login: "monalisa@fabrikam.test", avatar: null, url: null }, vote: 0.5, voteLabel: "Approved with suggestions", isRequired: false });
    assert.deepEqual(azure.urls().slice(1), ["https://dev.azure.com/fabrikam/_apis/connectionData",
      "https://dev.azure.com/fabrikam/_apis/git/repositories/3411ebc1-d5aa-464f-9615-0b527bc66719/pullRequests/12/reviewers/d6245f20-2af8-44f4-9451-8107cb2767db?api-version=7.1"]);
  });

  it("searches people and adds a reviewer only for the app's main process acting for a window, with a payload it takes", async () => {
    const azure = new FakeAzure();
    azure.hold();
    azure.answer(FakeAzure.json({ value: [{ subjectKind: "user", descriptor: "aad.TW9uYQ", displayName: "Mona Lisa", principalName: "monalisa@fabrikam.test" }] }),
      FakeAzure.json({ value: "d6245f20-2af8-44f4-9451-8107cb2767db" }),
      FakeAzure.json({ count: 1, value: [{ id: "D6245F20-2AF8-44F4-9451-8107CB2767DB", uniqueName: "monalisa@fabrikam.test", vote: 0 }] }));
    vi.stubGlobal("fetch", azure.fetch);
    const part = new RuntimePart();
    const context = new RuntimeContext();
    context.secrets.values.set("git-azure-devops.signIn", JSON.stringify({ token: "kept-token", organization: "fabrikam", account: account.toJson() }));
    const search = { reference, query: "mona" };
    const addition = { reference, descriptor: "aad.TW9uYQ" };

    await part.activateAsync(context.fake);
    const refusals: (readonly string[] | null)[] = [];
    for (const [client, window] of [["cli", null], ["chat", 1], [ShellClients.mainProcess, null]] as const) {
      refusals.push(await callAsync(context, "git-azure-devops.searchPeople", search, client, window).then(() => null, failureOf));
      refusals.push(await callAsync(context, "git-azure-devops.addReviewer", addition, client, window).then(() => null, failureOf));
    }
    for (const payload of [null, { ...search, query: " mo " }])
      refusals.push(await callAsync(context, "git-azure-devops.searchPeople", payload, ShellClients.mainProcess, 1).then(() => null, failureOf));
    for (const payload of [null, { ...addition, descriptor: "aad TW9uYQ" }])
      refusals.push(await callAsync(context, "git-azure-devops.addReviewer", payload, ShellClients.mainProcess, 1).then(() => null, failureOf));
    const answers = [await callAsync(context, "git-azure-devops.searchPeople", search, ShellClients.mainProcess, 1),
      await callAsync(context, "git-azure-devops.addReviewer", addition, ShellClients.mainProcess, 1)];
    await part.deactivateAsync();

    const unauthorized = [FailureCode.Unauthorized, "Only a person's sign-in in a window signs in to Azure DevOps."];
    const badSearch = [FailureCode.InvalidParams, "The search takes { reference, query }: an Azure DevOps pull request's reference and 3 to 100 characters."];
    const badAddition = [FailureCode.InvalidParams,
      "Adding a reviewer takes { reference, descriptor }: an Azure DevOps pull request's reference and a person's or group's descriptor."];
    assert.deepEqual(refusals, [...Array.from({ length: 6 }, () => unauthorized), badSearch, badSearch, badAddition, badAddition]);
    assert.deepEqual(answers, [[{ descriptor: "aad.TW9uYQ", name: "Mona Lisa", login: "monalisa@fabrikam.test", isGroup: false }],
      { person: { login: "monalisa@fabrikam.test", avatar: null, url: null }, vote: 0, voteLabel: "No vote", isRequired: false }]);
    assert.deepEqual(azure.urls().slice(1), ["https://vssps.dev.azure.com/fabrikam/_apis/graph/subjectquery?api-version=7.1-preview.1",
      "https://vssps.dev.azure.com/fabrikam/_apis/graph/storagekeys/aad.TW9uYQ?api-version=7.1-preview.1",
      "https://dev.azure.com/fabrikam/_apis/git/repositories/3411ebc1-d5aa-464f-9615-0b527bc66719/pullRequests/12/reviewers?api-version=7.1"]);
  });
});
