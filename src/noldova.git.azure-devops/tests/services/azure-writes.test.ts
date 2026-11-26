/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { FailureCode } from "@noldova/desktop.protocol";
import { MethodFailureException } from "@noldova/desktop.runtime";
import { FakeModuleLog } from "@noldova/desktop.runtime/testing";
import { HostComment, HostPerson, HostReference, HostReviewer, HostWorkItem, HostWorkItemDetail, HostWorkItemType, ThreadStatus, WorkItemCategory,
  WorkItemUpdate } from "@noldova/git.hosting.protocol";
import { describe, it } from "vitest";

import { AzureRepository } from "../../src/models/azure-repository.ts";
import { BranchLink } from "../../src/models/branch-link.ts";
import { PullRequestAbandonment } from "../../src/models/pull-request-abandonment.ts";
import { PullRequestCompletion } from "../../src/models/pull-request-completion.ts";
import { PullRequestVote } from "../../src/models/pull-request-vote.ts";
import { ReviewerAddition } from "../../src/models/reviewer-addition.ts";
import { ThreadChange } from "../../src/models/thread-change.ts";
import { ThreadReply } from "../../src/models/thread-reply.ts";
import { AzureApi } from "../../src/services/azure-api.ts";
import { AzureReads } from "../../src/services/azure-reads.ts";
import { AzureWrites } from "../../src/services/azure-writes.ts";
import { FakeAzure, FakeToken } from "../fixtures/fake-azure.fixture.ts";

function repositoryOf(path: string): AzureRepository {
  const repository = AzureRepository.parse("dev.azure.com", path);
  if (repository === null)
    throw new Error(`${path} isn't an Azure DevOps repository.`);
  return repository;
}

const signal: AbortSignal = new AbortController().signal;
const projectId: string = "6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c";
const repositoryId: string = "3411ebc1-d5aa-464f-9615-0b527bc66719";
const link: BranchLink = new BranchLink(repositoryOf("fabrikam/Web Site/_git/site"), 42, "42-sign-in/with token");
const repositoryUrl: string = "https://dev.azure.com/fabrikam/Web%20Site/_apis/git/repositories/site?api-version=7.1";
const workItemUrl: string = "https://dev.azure.com/fabrikam/_apis/wit/workitems/42?api-version=7.1";
const repository = (): Response => FakeAzure.json({ id: repositoryId, name: "site", project: { id: projectId, name: "Web Site" } });

function writesOf(azure: FakeAzure, token: FakeToken): AzureWrites {
  const api = new AzureApi(azure.fetch);
  return new AzureWrites(api, token, new AzureReads(api, token, new FakeModuleLog()));
}

const reference: HostReference = new HostReference("git-azure-devops", "fabrikam", repositoryId, 12);
const reply: ThreadReply = new ThreadReply(reference, 3, 1, "Fixed in **the next** commit.");
const resolve: ThreadChange = new ThreadChange(reference, 3, ThreadStatus.Resolved);
const threadUrl: string = `https://dev.azure.com/fabrikam/_apis/git/repositories/${repositoryId}/pullRequests/12/threads/3?api-version=7.1`;
const commentsUrl: string = `https://dev.azure.com/fabrikam/_apis/git/repositories/${repositoryId}/pullRequests/12/threads/3/comments?api-version=7.1`;
const posted = (): Response => FakeAzure.json({ id: 2, parentCommentId: 1, author: { displayName: "Mona Lisa", uniqueName: "monalisa@fabrikam.test" },
  content: "Fixed in **the next** commit.", publishedDate: "2027-01-15T10:05:00Z", lastUpdatedDate: "2027-01-15T10:05:00Z", commentType: "text" });

const personId: string = "d6245f20-2af8-44f4-9451-8107cb2767db";
const approve: PullRequestVote = new PullRequestVote(reference, 10);
const reviewerUrl: string = `https://dev.azure.com/fabrikam/_apis/git/repositories/${repositoryId}/pullRequests/12/reviewers/${personId}?api-version=7.1`;
const connection = (): Response => FakeAzure.json({ authenticatedUser: { id: personId, providerDisplayName: "Mona Lisa" } });
const voted = (vote: number): Response => FakeAzure.json({ id: personId, displayName: "Mona Lisa", uniqueName: "monalisa@fabrikam.test", vote, isRequired: true });

function failureOf(error: unknown): readonly string[] | null {
  return error instanceof MethodFailureException ? [error.failure.code, error.failure.message] : null;
}

describe("AzureWrites", () => {
  it("links the branch to the work item as an artifact link to its ref in the repository's project, with the token and a JSON patch", async () => {
    const azure = new FakeAzure();
    azure.answer(repository(), FakeAzure.json({ id: 42 }));
    const writes = writesOf(azure, new FakeToken());

    await writes.linkBranchAsync(link, signal);

    const patch = azure.requests[1];
    assert.deepEqual(azure.urls(), [repositoryUrl, workItemUrl]);
    assert.deepEqual([patch?.init.method, patch?.header("Content-Type"), patch?.header("Accept"), patch?.header("Authorization"), patch?.body], ["PATCH",
      "application/json-patch+json", "application/json", `Basic ${Buffer.from(":azure-token").toString("base64")}`, [{ op: "add", path: "/relations/-",
        value: { rel: "ArtifactLink", url: `vstfs:///Git/Ref/${projectId}%2F${repositoryId}%2FGB42-sign-in%2Fwith%20token`, attributes: { name: "Branch" } } }]]);
    assert.equal(azure.requests[0]?.init.method, undefined);
  });

  it("refuses as signed out with no token, no organization, or a repository in another organization than the token's, asking nothing", async () => {
    const azure = new FakeAzure();
    const unorganized = new FakeToken();
    unorganized.answer("organization", null);
    const tokens: readonly FakeToken[] = [new FakeToken(null), unorganized, new FakeToken("azure-token", "contoso")];

    const failures: unknown[] = [];
    for (const token of tokens)
      failures.push(failureOf(await writesOf(azure, token).linkBranchAsync(link, signal).then(() => null, (t: unknown) => t)));

    const signedOut = [FailureCode.Unauthorized, "Sign in to Azure DevOps first."];
    assert.deepEqual([failures, azure.requests.length], [[signedOut, signedOut, signedOut], 0]);
  });

  it("fails as NotFound for a repository or work item Azure DevOps doesn't show, and as Unavailable for a repository it can't read", async () => {
    const azure = new FakeAzure();
    azure.answer(new Response(null, { status: 404 }), repository(), new Response(null, { status: 404 }), FakeAzure.json({ id: repositoryId }));
    const writes = writesOf(azure, new FakeToken());

    const failures: unknown[] = [];
    for (let attempt = 0; attempt < 3; attempt++)
      failures.push(failureOf(await writes.linkBranchAsync(link, signal).then(() => null, (t: unknown) => t)));

    assert.deepEqual(failures, [[FailureCode.NotFound, "Azure DevOps doesn't show this repository."], [FailureCode.NotFound, "Azure DevOps doesn't show this work item."],
      [FailureCode.Unavailable, "Azure DevOps' answer couldn't be read at $.project."]]);
  });

  it("says the token can't write work items when Azure DevOps refuses the link but still takes the token, and passes on the sign-out when it doesn't", async () => {
    const azure = new FakeAzure();
    azure.answer(repository(), new Response(null, { status: 401 }), repository(), new Response(null, { status: 401 }));
    const scoped = new FakeToken();
    const revoked = new FakeToken();
    revoked.answer("refusedAsync", async () => {
      revoked.answer("token", null);
    });

    const cannotWrite = failureOf(await writesOf(azure, scoped).linkBranchAsync(link, signal).then(() => null, (t: unknown) => t));
    const signedOut = failureOf(await writesOf(azure, revoked).linkBranchAsync(link, signal).then(() => null, (t: unknown) => t));

    assert.deepEqual([cannotWrite, signedOut, scoped.refused, revoked.refused], [[FailureCode.Unauthorized,
      "The Azure DevOps token can't write work items; it needs the Work Items (Read & write) scope."], [FailureCode.Unauthorized, "Sign in to Azure DevOps first."],
      ["azure-token"], ["azure-token"]]);
  });

  it("reports a refused repository read so the sign-in checks the token, and passes on any other failure as it is", async () => {
    const azure = new FakeAzure();
    azure.answer(new Response(null, { status: 401 }), new Response(null, { status: 500 }), repository(), new Response(null, { status: 500 }));
    const token = new FakeToken();
    const writes = writesOf(azure, token);

    const failures: unknown[] = [];
    for (let attempt = 0; attempt < 3; attempt++)
      failures.push(failureOf(await writes.linkBranchAsync(link, signal).then(() => null, (t: unknown) => t)));

    assert.deepEqual([failures, token.refused], [[[FailureCode.Unauthorized, "Sign in to Azure DevOps first."], [FailureCode.Unavailable,
      "Azure DevOps refused the request (500)."], [FailureCode.Unavailable, "Azure DevOps refused the request (500)."]], ["azure-token"]]);
  });

  it("posts a reply as a text comment answering its parent, and answers the comment Azure DevOps made", async () => {
    const azure = new FakeAzure();
    azure.answer(posted());
    const writes = writesOf(azure, new FakeToken());

    const comment: HostComment = await writes.replyToThreadAsync(reply, signal);

    const post = azure.requests[0];
    assert.deepEqual(comment, new HostComment(2, 1, new HostPerson("monalisa@fabrikam.test", null, null, undefined, "Mona Lisa"), Date.parse("2027-01-15T10:05:00Z"),
      "Fixed in **the next** commit."));
    assert.deepEqual([azure.urls(), post?.init.method, post?.header("Content-Type"), post?.body], [[commentsUrl], "POST", "application/json",
      { content: "Fixed in **the next** commit.", parentCommentId: 1, commentType: 1 }]);
  });

  it("resolves a thread as fixed and reactivates it as active, with a JSON body", async () => {
    const azure = new FakeAzure();
    azure.answer(FakeAzure.json({ id: 3, status: "fixed" }), FakeAzure.json({ id: 3, status: "active" }));
    const writes = writesOf(azure, new FakeToken());

    await writes.changeThreadAsync(resolve, signal);
    await writes.changeThreadAsync(new ThreadChange(reference, 3, ThreadStatus.Active), signal);

    assert.deepEqual([azure.urls(), azure.requests.map(t => [t.init.method, t.header("Content-Type"), t.body])], [[threadUrl, threadUrl], [
      ["PATCH", "application/json", { status: "fixed" }], ["PATCH", "application/json", { status: "active" }]]]);
  });

  it("refuses a thread write as signed out for another organization than the token's, asking nothing", async () => {
    const azure = new FakeAzure();
    const writes = writesOf(azure, new FakeToken("azure-token", "contoso"));

    const failures = [failureOf(await writes.replyToThreadAsync(reply, signal).then(() => null, (t: unknown) => t)),
      failureOf(await writes.changeThreadAsync(resolve, signal).then(() => null, (t: unknown) => t))];

    const signedOut = [FailureCode.Unauthorized, "Sign in to Azure DevOps first."];
    assert.deepEqual([failures, azure.requests.length], [[signedOut, signedOut], 0]);
  });

  it("says the token can't write code when Azure DevOps refuses a thread write but still takes the token, and NotFound for a thread it doesn't show", async () => {
    const azure = new FakeAzure();
    azure.answer(new Response(null, { status: 401 }), new Response(null, { status: 401 }), new Response(null, { status: 404 }), new Response(null, { status: 404 }),
      FakeAzure.json({ id: 2 }), new Response(null, { status: 500 }));
    const token = new FakeToken();
    const writes = writesOf(azure, token);

    const failures = [failureOf(await writes.replyToThreadAsync(reply, signal).then(() => null, (t: unknown) => t)),
      failureOf(await writes.changeThreadAsync(resolve, signal).then(() => null, (t: unknown) => t)),
      failureOf(await writes.replyToThreadAsync(reply, signal).then(() => null, (t: unknown) => t)),
      failureOf(await writes.changeThreadAsync(resolve, signal).then(() => null, (t: unknown) => t)),
      failureOf(await writes.replyToThreadAsync(reply, signal).then(() => null, (t: unknown) => t)),
      failureOf(await writes.changeThreadAsync(resolve, signal).then(() => null, (t: unknown) => t))];

    const cannotWrite = [FailureCode.Unauthorized, "The Azure DevOps token can't write code comments; it needs the Code (Read & write) scope."];
    const missing = [FailureCode.NotFound, "Azure DevOps doesn't show this comment thread."];
    assert.deepEqual([failures, token.refused], [[cannotWrite, cannotWrite, missing, missing, [FailureCode.Unavailable, "Azure DevOps' answer couldn't be read at $.author."],
      [FailureCode.Unavailable, "Azure DevOps refused the request (500)."]], ["azure-token", "azure-token"]]);
  });

  it("sets the signed-in person's vote as their reviewer entry, with a JSON body, and answers them as a reviewer", async () => {
    const azure = new FakeAzure();
    azure.answer(connection(), voted(10), connection(), voted(-5));
    const writes = writesOf(azure, new FakeToken());

    const reviewers: HostReviewer[] = [await writes.voteAsync(approve, signal), await writes.voteAsync(new PullRequestVote(reference, -5), signal)];

    const mona = new HostPerson("monalisa@fabrikam.test", null, null, undefined, "Mona Lisa");
    assert.deepEqual(reviewers, [new HostReviewer(mona, 1, "Approved", true), new HostReviewer(mona, -0.5, "Waiting for the author", true)]);
    const puts = [azure.requests[1], azure.requests[3]].map(t => [t?.init.method, t?.header("Content-Type"), t?.body]);
    assert.deepEqual([azure.urls(), azure.requests.map(t => t.init.method), puts], [[connectionUrl, reviewerUrl, connectionUrl, reviewerUrl],
      [undefined, "PUT", undefined, "PUT"], [["PUT", "application/json", { vote: 10 }], ["PUT", "application/json", { vote: -5 }]]]);
  });

  it("asks to sign in again before a reply, thread change or vote when the sign-in was renewed without code writes, asking nothing", async () => {
    const azure = new FakeAzure();
    const token = new FakeToken();
    token.token?.renew("access-1", false);
    const writes = writesOf(azure, token);

    const failures = [failureOf(await writes.replyToThreadAsync(reply, signal).then(() => null, (t: unknown) => t)),
      failureOf(await writes.changeThreadAsync(resolve, signal).then(() => null, (t: unknown) => t)),
      failureOf(await writes.voteAsync(approve, signal).then(() => null, (t: unknown) => t))];

    const again = [FailureCode.Unauthorized, "Sign in to Azure DevOps again to allow replies, thread states and votes; the sign-in from before them can't make them."];
    assert.deepEqual([failures, azure.requests.length], [[again, again, again], 0]);
  });

  it("says the token can't vote when Azure DevOps refuses the vote as forbidden, and names a missing permission when it does", async () => {
    const azure = new FakeAzure();
    azure.answer(connection(), FakeAzure.json({ message: "Access denied." }, 403), connection(),
      FakeAzure.json({ message: "TF401027: You need the Git 'PullRequestContribute' permission to perform this action." }, 403));
    const token = new FakeToken();
    const writes = writesOf(azure, token);

    const failures = [failureOf(await writes.voteAsync(approve, signal).then(() => null, (t: unknown) => t)),
      failureOf(await writes.voteAsync(approve, signal).then(() => null, (t: unknown) => t))];

    assert.deepEqual([failures, token.refused], [[[FailureCode.Unauthorized, "The Azure DevOps token can't vote on pull requests; it needs the Code (Read & write) scope."],
      [FailureCode.Unavailable, "Azure DevOps says this account lacks the permission for this in the repository; ask one of its administrators."]], ["azure-token"]]);
  });

  it("refuses a vote as signed out for another organization than the token's, asking nothing", async () => {
    const azure = new FakeAzure();
    const writes = writesOf(azure, new FakeToken("azure-token", "contoso"));

    const failure = failureOf(await writes.voteAsync(approve, signal).then(() => null, (t: unknown) => t));

    assert.deepEqual([failure, azure.requests.length], [[FailureCode.Unauthorized, "Sign in to Azure DevOps first."], 0]);
  });

  it("says the token can't vote when Azure DevOps refuses the vote but still takes the token, and NotFound for a pull request or account it doesn't show", async () => {
    const azure = new FakeAzure();
    azure.answer(connection(), new Response(null, { status: 401 }), connection(), new Response(null, { status: 404 }), new Response(null, { status: 404 }),
      new Response(null, { status: 401 }), FakeAzure.json({ authenticatedUser: { id: " " } }), connection(), FakeAzure.json({ id: personId }));
    const token = new FakeToken();
    const writes = writesOf(azure, token);

    const failures: unknown[] = [];
    for (let attempt = 0; attempt < 6; attempt++)
      failures.push(failureOf(await writes.voteAsync(approve, signal).then(() => null, (t: unknown) => t)));

    const unreadable = [FailureCode.Unavailable, "Azure DevOps' answer couldn't be read."];
    assert.deepEqual([failures, token.refused], [[[FailureCode.Unauthorized, "The Azure DevOps token can't vote on pull requests; it needs the Code (Read & write) scope."],
      [FailureCode.NotFound, "Azure DevOps doesn't show this pull request."], unreadable,
      [FailureCode.Unauthorized, "Sign in to Azure DevOps first."], [FailureCode.Unavailable, "Azure DevOps' answer couldn't be read at $.authenticatedUser.id."], [FailureCode.Unavailable, "Azure DevOps' answer couldn't be read at $.vote."]], ["azure-token", "azure-token"]]);
  });
});

const sourceCommit: string = "9f2c4e1a7b3d5f6081c2e4a6b8d0f1e3a5c7b9d1";
const squash: PullRequestCompletion = new PullRequestCompletion(reference, sourceCommit, "main", "squash", "Merged PR 12: Fold tag case", true, false);
const pullUrl: string = `https://dev.azure.com/fabrikam/_apis/git/repositories/${repositoryId}/pullrequests/12?api-version=7.1`;
const evaluationsUrl: string = `https://dev.azure.com/fabrikam/${projectId}/_apis/policy/evaluations?artifactId=`
  + `${encodeURIComponent(`vstfs:///CodeReview/CodeReviewId/${projectId}/12`)}&api-version=7.1-preview.1`;
const mergeable = { status: "active", isDraft: false, mergeStatus: "succeeded", targetRefName: "refs/heads/main", lastMergeSourceCommit: { commitId: sourceCommit },
  repository: { project: { id: projectId } } };
const pullOf = (changes: object = {}): Response => FakeAzure.json({ ...mergeable, ...changes });
const policy = (type: string, settings: object = {}): object => ({ status: "approved", configuration: { isBlocking: true, type: { id: type, displayName: "Policy" }, settings } });
const limitType: string = "fa4e907d-c16b-4a4c-9dfa-4916e5d171ab";
const evaluationsOf = (...policies: object[]): Response => FakeAzure.json({ count: policies.length, value: policies });

describe("AzureWrites' completion", () => {
  it("reads the pull request and its policies again, then completes it with the commit the page showed and the person's options, never bypassing a policy", async () => {
    const azure = new FakeAzure();
    azure.answer(pullOf(), evaluationsOf(), FakeAzure.json({ status: "completed" }), pullOf(), new Response(null, { status: 404 }),
      FakeAzure.json({ status: "completed" }));
    const writes = writesOf(azure, new FakeToken());
    const rebase = new PullRequestCompletion(reference, sourceCommit, "main", "rebase", null, false, true);

    await writes.completePullRequestAsync(squash, signal);
    await writes.completePullRequestAsync(rebase, signal);

    const patches = azure.requests.filter(t => t.init.method === "PATCH").map(t => [t.header("Content-Type"), t.body]);
    assert.deepEqual([azure.urls(), azure.requests.map(t => t.init.method)], [[pullUrl, evaluationsUrl, pullUrl, pullUrl, evaluationsUrl, pullUrl],
      [undefined, undefined, "PATCH", undefined, undefined, "PATCH"]]);
    assert.deepEqual(patches, [["application/json", { status: "completed", lastMergeSourceCommit: { commitId: sourceCommit }, completionOptions: { mergeStrategy: "squash",
      mergeCommitMessage: "Merged PR 12: Fold tag case", transitionWorkItems: true, deleteSourceBranch: false } }],
    ["application/json", { status: "completed", lastMergeSourceCommit: { commitId: sourceCommit }, completionOptions: { mergeStrategy: "rebase", mergeCommitMessage: null,
      transitionWorkItems: false, deleteSourceBranch: true } }]]);
  });

  it("fails as Conflict with why, writing nothing, when the pull request isn't active, is a draft, has no clean merge, or another commit or target", async () => {
    const azure = new FakeAzure();
    azure.answer(pullOf({ status: "completed" }), pullOf({ isDraft: true }), pullOf({ mergeStatus: undefined }), pullOf({ mergeStatus: "conflicts" }),
      pullOf({ lastMergeSourceCommit: { commitId: "1".repeat(40) } }), pullOf({ targetRefName: "refs/heads/release" }), pullOf({ targetRefName: "main" }));
    const writes = writesOf(azure, new FakeToken());

    const failures: unknown[] = [];
    for (let attempt = 0; attempt < 7; attempt++)
      failures.push(failureOf(await writes.completePullRequestAsync(squash, signal).then(() => null, (t: unknown) => t)));

    const notReady = [FailureCode.Conflict, "Azure DevOps shows no clean merge of the pull request yet, such as while it merges or when it conflicts; read it again."];
    const otherTarget = [FailureCode.Conflict, "The pull request's target branch changed since the page read it; read it again before completing it."];
    assert.deepEqual([failures, azure.urls()], [[[FailureCode.Conflict, "The pull request isn't active any more; read it again."],
      [FailureCode.Conflict, "The pull request is a draft; publish it in Azure DevOps before completing it."], notReady, notReady,
      [FailureCode.Conflict, "The pull request has new commits since the page read it; read it again before completing it."], otherTarget, otherTarget],
    Array(7).fill(pullUrl)]);
  });

  it("completes only with a merge type every merge-type policy allows, ignoring other policies, and fails as Conflict before writing for another", async () => {
    const azure = new FakeAzure();
    const squashOnly = policy(limitType, { allowSquash: true, allowRebase: false });
    azure.answer(pullOf(), evaluationsOf(policy("0609b952-1397-4640-95ec-e00a01b2c241"), squashOnly), FakeAzure.json({ status: "completed" }),
      pullOf(), evaluationsOf(squashOnly, policy(limitType, { allowNoFastForward: true, allowSquash: true })),
      pullOf(), evaluationsOf(squashOnly, policy(limitType, { allowNoFastForward: true })));
    const writes = writesOf(azure, new FakeToken());

    await writes.completePullRequestAsync(squash, signal);
    const failures = [failureOf(await writes.completePullRequestAsync(new PullRequestCompletion(reference, sourceCommit, "main", "noFastForward", "Merged PR 12",
      false, false), signal).then(() => null, (t: unknown) => t)), failureOf(await writes.completePullRequestAsync(squash, signal).then(() => null, (t: unknown) => t))];

    const notAllowed = [FailureCode.Conflict, "The target branch's policy doesn't allow this merge type; choose another."];
    assert.deepEqual([failures, azure.requests.map(t => t.init.method)], [[notAllowed, notAllowed],
      [undefined, undefined, "PATCH", undefined, undefined, undefined, undefined]]);
  });

  it("refuses as signed out for another organization, and asks to sign in again for a sign-in without code writes, asking nothing", async () => {
    const azure = new FakeAzure();
    const renewed = new FakeToken();
    renewed.token?.renew("access-1", false);

    const failures = [failureOf(await writesOf(azure, new FakeToken("azure-token", "contoso")).completePullRequestAsync(squash, signal).then(() => null, (t: unknown) => t)),
      failureOf(await writesOf(azure, renewed).completePullRequestAsync(squash, signal).then(() => null, (t: unknown) => t))];

    assert.deepEqual([failures, azure.requests.length], [[[FailureCode.Unauthorized, "Sign in to Azure DevOps first."], [FailureCode.Unauthorized,
      "Sign in to Azure DevOps again to allow replies, thread states and votes; the sign-in from before them can't make them."]], 0]);
  });

  it("says the token can't complete when Azure DevOps refuses the write, NotFound for a pull request it doesn't show, and Unavailable for one it can't read", async () => {
    const azure = new FakeAzure();
    azure.answer(pullOf(), evaluationsOf(), new Response(null, { status: 401 }), pullOf(), evaluationsOf(), FakeAzure.json({ message: "Access denied." }, 403),
      new Response(null, { status: 404 }), pullOf(), evaluationsOf(), new Response(null, { status: 404 }), pullOf({ status: 3 }),
      pullOf({ repository: {} }));
    const token = new FakeToken();
    const writes = writesOf(azure, token);

    const failures: unknown[] = [];
    for (let attempt = 0; attempt < 6; attempt++)
      failures.push(failureOf(await writes.completePullRequestAsync(squash, signal).then(() => null, (t: unknown) => t)));

    const cannot = [FailureCode.Unauthorized, "The Azure DevOps token can't complete pull requests; it needs the Code (Read & write) scope."];
    const missing = [FailureCode.NotFound, "Azure DevOps doesn't show this pull request."];
    assert.deepEqual([failures, token.refused], [[cannot, cannot, missing, missing, [FailureCode.Unavailable, "Azure DevOps' answer couldn't be read at $.status."], [FailureCode.Unavailable, "Azure DevOps' answer couldn't be read at $.repository.project."]], ["azure-token", "azure-token"]]);
  });
});

const abandon: PullRequestAbandonment = new PullRequestAbandonment(reference, sourceCommit);

describe("AzureWrites' auto-complete and abandon", () => {
  it("sets auto-complete as the signed-in person with the person's options once the policies allow the merge type, needing no clean merge yet", async () => {
    const azure = new FakeAzure();
    azure.answer(pullOf({ mergeStatus: "queued" }), evaluationsOf(), connection(), FakeAzure.json({ status: "active" }));
    const writes = writesOf(azure, new FakeToken());

    await writes.setAutoCompleteAsync(squash, signal);

    assert.deepEqual([azure.urls(), azure.requests.map(t => t.init.method)], [[pullUrl, evaluationsUrl, "https://dev.azure.com/fabrikam/_apis/connectionData", pullUrl],
      [undefined, undefined, undefined, "PATCH"]]);
    assert.deepEqual(azure.requests[3]?.body, { autoCompleteSetBy: { id: personId }, completionOptions: { mergeStrategy: "squash",
      mergeCommitMessage: "Merged PR 12: Fold tag case", transitionWorkItems: true, deleteSourceBranch: false } });
  });

  it("fails as Conflict with why before setting auto-complete when the pull request isn't active, is a draft, has another commit or target, or a merge type its policy forbids", async () => {
    const azure = new FakeAzure();
    azure.answer(pullOf({ status: "abandoned" }), pullOf({ isDraft: true }), pullOf({ lastMergeSourceCommit: { commitId: "1".repeat(40) } }),
      pullOf({ targetRefName: "refs/heads/release" }), pullOf(), evaluationsOf(policy(limitType, { allowNoFastForward: true })));
    const writes = writesOf(azure, new FakeToken());

    const failures: unknown[] = [];
    for (let attempt = 0; attempt < 5; attempt++)
      failures.push(failureOf(await writes.setAutoCompleteAsync(squash, signal).then(() => null, (t: unknown) => t)));

    assert.deepEqual([failures, azure.requests.some(t => t.init.method === "PATCH")], [[[FailureCode.Conflict, "The pull request isn't active any more; read it again."],
      [FailureCode.Conflict, "The pull request is a draft; publish it in Azure DevOps before completing it."],
      [FailureCode.Conflict, "The pull request has new commits since the page read it; read it again before completing it."],
      [FailureCode.Conflict, "The pull request's target branch changed since the page read it; read it again before completing it."],
      [FailureCode.Conflict, "The target branch's policy doesn't allow this merge type; choose another."]], false]);
  });

  it("says the token can't complete when Azure DevOps refuses auto-complete, and fails as Unavailable for a person it can't read", async () => {
    const azure = new FakeAzure();
    azure.answer(pullOf(), evaluationsOf(), connection(), new Response(null, { status: 401 }), pullOf(), evaluationsOf(), FakeAzure.json({ authenticatedUser: {} }));
    const writes = writesOf(azure, new FakeToken());

    const failures = [failureOf(await writes.setAutoCompleteAsync(squash, signal).then(() => null, (t: unknown) => t)),
      failureOf(await writes.setAutoCompleteAsync(squash, signal).then(() => null, (t: unknown) => t))];

    assert.deepEqual(failures, [[FailureCode.Unauthorized, "The Azure DevOps token can't complete pull requests; it needs the Code (Read & write) scope."],
      [FailureCode.Unavailable, "Azure DevOps' answer couldn't be read at $.authenticatedUser.id."]]);
  });

  it("cancels auto-complete by clearing who set it, only on an active pull request", async () => {
    const azure = new FakeAzure();
    azure.answer(pullOf(), FakeAzure.json({ status: "active" }), pullOf({ status: "completed" }), new Response(null, { status: 404 }), pullOf(),
      new Response(null, { status: 401 }));
    const writes = writesOf(azure, new FakeToken());

    await writes.cancelAutoCompleteAsync(reference, signal);
    const failures: unknown[] = [];
    for (let attempt = 0; attempt < 3; attempt++)
      failures.push(failureOf(await writes.cancelAutoCompleteAsync(reference, signal).then(() => null, (t: unknown) => t)));

    assert.deepEqual([azure.urls(), azure.requests[1]?.init.method, azure.requests[1]?.body], [Array(6).fill(pullUrl), "PATCH",
      { autoCompleteSetBy: { id: "00000000-0000-0000-0000-000000000000" } }]);
    assert.deepEqual(failures, [[FailureCode.Conflict, "The pull request isn't active any more; read it again."],
      [FailureCode.NotFound, "Azure DevOps doesn't show this pull request."],
      [FailureCode.Unauthorized, "The Azure DevOps token can't change pull requests; it needs the Code (Read & write) scope."]]);
  });

  it("abandons an active pull request at the commit the page showed, and fails as Conflict with why for another, writing nothing", async () => {
    const azure = new FakeAzure();
    azure.answer(pullOf({ mergeStatus: "conflicts", isDraft: true }), FakeAzure.json({ status: "abandoned" }), pullOf({ status: "abandoned" }),
      pullOf({ lastMergeSourceCommit: { commitId: "1".repeat(40) } }), pullOf({ status: 3 }));
    const writes = writesOf(azure, new FakeToken());

    await writes.abandonPullRequestAsync(abandon, signal);
    const failures: unknown[] = [];
    for (let attempt = 0; attempt < 3; attempt++)
      failures.push(failureOf(await writes.abandonPullRequestAsync(abandon, signal).then(() => null, (t: unknown) => t)));

    assert.deepEqual([azure.requests.map(t => t.init.method), azure.requests[1]?.body], [[undefined, "PATCH", undefined, undefined, undefined], { status: "abandoned" }]);
    assert.deepEqual(failures, [[FailureCode.Conflict, "The pull request isn't active any more; read it again."],
      [FailureCode.Conflict, "The pull request has new commits since the page read it; read it again before abandoning it."],
      [FailureCode.Unavailable, "Azure DevOps' answer couldn't be read at $.status."]]);
  });

  it("refuses each as signed out for another organization, asking nothing", async () => {
    const azure = new FakeAzure();
    const writes = writesOf(azure, new FakeToken("azure-token", "contoso"));

    const failures = [failureOf(await writes.setAutoCompleteAsync(squash, signal).then(() => null, (t: unknown) => t)),
      failureOf(await writes.cancelAutoCompleteAsync(reference, signal).then(() => null, (t: unknown) => t)),
      failureOf(await writes.abandonPullRequestAsync(abandon, signal).then(() => null, (t: unknown) => t))];

    assert.deepEqual([failures, azure.requests.length], [Array(3).fill([FailureCode.Unauthorized, "Sign in to Azure DevOps first."]), 0]);
  });
});

const connectionUrl: string = "https://dev.azure.com/fabrikam/_apis/connectionData";
const updateUrl: string = "https://dev.azure.com/fabrikam/_apis/wit/workitems/42?$expand=relations&api-version=7.1";
const typeUrl: string = "https://dev.azure.com/fabrikam/Web%20Site/_apis/wit/workitemtypes/Bug?api-version=7.1";
const iconUrl: string = "https://dev.azure.com/fabrikam/_apis/wit/workitemicons/icon_insect?color=CC293D&v=2&api-version=7.1";
const noIcon = (): Response => new Response(null, { status: 404 });
const profile = (properties: Readonly<Record<string, unknown>> = { Account: { $value: "monalisa@fabrikam.test" } }): Response =>
  FakeAzure.json({ authenticatedUser: { providerDisplayName: "Mona Lisa", properties } });
const changed = (): Response => FakeAzure.json({ id: 42, fields: { "System.TeamProject": "Web Site", "System.WorkItemType": "Bug", "System.Title": "Fix the sign-in",
  "System.State": "Active", "System.AssignedTo": { displayName: "Mona Lisa", uniqueName: "monalisa@fabrikam.test" } }, relations: [] });
const bugType = (): Response => FakeAzure.json({ name: "Bug", color: "CC293D", icon: { id: "icon_insect" }, states: [{ name: "Active", category: "InProgress" }] });
const detail: HostWorkItemDetail = new HostWorkItemDetail(new HostWorkItem("git-azure-devops", "fabrikam", "Web Site", 42,
  new HostWorkItemType("Bug", "CC293D", "icon_insect"), "Fix the sign-in", "Active", WorkItemCategory.InProgress,
  "https://dev.azure.com/fabrikam/Web%20Site/_workitems/edit/42", new HostPerson("monalisa@fabrikam.test", null, null, undefined, "Mona Lisa"), null, null, null), null, null, null, null,
null, [], [], 0, []);
const update: WorkItemUpdate = new WorkItemUpdate("git-azure-devops", "fabrikam", 42, "Active", true);

describe("AzureWrites, work items", () => {
  it("moves a work item to a state and assigns it to the signed-in person's account with a JSON patch, answering its detail", async () => {
    const azure = new FakeAzure();
    azure.answer(profile(), changed(), bugType(), noIcon());

    const answer: HostWorkItemDetail = await writesOf(azure, new FakeToken()).updateWorkItemAsync(update, signal);

    const patch = azure.requests[1];
    assert.deepEqual([answer, azure.urls()], [detail, [connectionUrl, updateUrl, typeUrl, iconUrl]]);
    assert.deepEqual([patch?.init.method, patch?.header("Content-Type"), patch?.body], ["PATCH", "application/json-patch+json", [
      { op: "add", path: "/fields/System.State", value: "Active" }, { op: "add", path: "/fields/System.AssignedTo", value: "monalisa@fabrikam.test" }]]);
  });

  it("only moves the state, or only assigns, when the update asks for one", async () => {
    const azure = new FakeAzure();
    azure.answer(changed(), bugType(), noIcon(), profile(), changed());
    const writes = writesOf(azure, new FakeToken());

    await writes.updateWorkItemAsync(new WorkItemUpdate("git-azure-devops", "fabrikam", 42, "Active", false), signal);
    await writes.updateWorkItemAsync(new WorkItemUpdate("git-azure-devops", "fabrikam", 42, null, true), signal);

    assert.deepEqual([azure.urls(), azure.requests[0]?.body, azure.requests[4]?.body], [[updateUrl, typeUrl, iconUrl, connectionUrl, updateUrl], [{ op: "add", path: "/fields/System.State", value: "Active" }],
    [{ op: "add", path: "/fields/System.AssignedTo", value: "monalisa@fabrikam.test" }]]);
  });

  it("refuses as signed out with no token, for another host's work item or one in another organization than the token's, asking nothing", async () => {
    const azure = new FakeAzure();
    const writes = writesOf(azure, new FakeToken());

    const failures: unknown[] = [
      failureOf(await writesOf(azure, new FakeToken(null)).updateWorkItemAsync(update, signal).then(() => null, (t: unknown) => t)),
      failureOf(await writes.updateWorkItemAsync(new WorkItemUpdate("git-github", "fabrikam", 42, "Active", false), signal).then(() => null, (t: unknown) => t)),
      failureOf(await writes.updateWorkItemAsync(new WorkItemUpdate("git-azure-devops", "contoso", 42, "Active", false), signal).then(() => null, (t: unknown) => t))
    ];

    const signedOut = [FailureCode.Unauthorized, "Sign in to Azure DevOps first."];
    assert.deepEqual([failures, azure.requests.length], [[signedOut, signedOut, signedOut], 0]);
  });

  it("fails as NotFound for a work item Azure DevOps doesn't show, and as Unavailable for an account or answer it can't read", async () => {
    const azure = new FakeAzure();
    azure.answer(profile(), new Response(null, { status: 404 }), new Response(null, { status: 404 }), profile({}),
      profile(), FakeAzure.json({ id: 42, fields: {} }));
    const writes = writesOf(azure, new FakeToken());

    const failures: unknown[] = [];
    for (let attempt = 0; attempt < 4; attempt++)
      failures.push(failureOf(await writes.updateWorkItemAsync(update, signal).then(() => null, (t: unknown) => t)));

    const unreadable = [FailureCode.Unavailable, "Azure DevOps' answer couldn't be read."];
    assert.deepEqual(failures, [[FailureCode.NotFound, "Azure DevOps doesn't show this work item."], unreadable, [FailureCode.Unavailable, "Azure DevOps' answer couldn't be read at $.authenticatedUser.properties.Account."], [FailureCode.Unavailable, "Azure DevOps' answer couldn't be read at $.fields.System.TeamProject."]]);
  });

  it("says the token can't write work items when Azure DevOps refuses the change, and reports a refused account or type read so the sign-in checks the token", async () => {
    const azure = new FakeAzure();
    azure.answer(profile(), new Response(null, { status: 401 }), new Response(null, { status: 401 }), profile(), changed(), new Response(null, { status: 401 }));
    const token = new FakeToken();
    const writes = writesOf(azure, token);

    const failures: unknown[] = [];
    for (let attempt = 0; attempt < 3; attempt++)
      failures.push(failureOf(await writes.updateWorkItemAsync(update, signal).then(() => null, (t: unknown) => t)));

    const signedOut = [FailureCode.Unauthorized, "Sign in to Azure DevOps first."];
    assert.deepEqual([failures, token.refused], [[[FailureCode.Unauthorized,
      "The Azure DevOps token can't write work items; it needs the Work Items (Read & write) scope."], signedOut, signedOut],
    ["azure-token", "azure-token", "azure-token"]]);
  });
});

const addition: ReviewerAddition = new ReviewerAddition(reference, "aad.TW9uYQ");
const storageKeyUrl: string = "https://vssps.dev.azure.com/fabrikam/_apis/graph/storagekeys/aad.TW9uYQ?api-version=7.1-preview.1";
const reviewersUrl: string = `https://dev.azure.com/fabrikam/_apis/git/repositories/${repositoryId}/pullRequests/12/reviewers?api-version=7.1`;
const storageKey = (): Response => FakeAzure.json({ value: personId });
const added = (id: string = personId.toUpperCase()): Response => FakeAzure.json({ count: 2, value: [
  { id: "0b5c9e4e-7e3a-4bd8-8bd5-1c0d6f3a3c52", uniqueName: "octocat@fabrikam.test", vote: 10 }, { id, uniqueName: "monalisa@fabrikam.test", vote: 0 }] });

describe("AzureWrites, reviewers", () => {
  it("reads the person's id from their descriptor and adds them as an optional reviewer with no vote, answering their entry", async () => {
    const azure = new FakeAzure();
    azure.answer(storageKey(), added());
    const writes = writesOf(azure, new FakeToken());

    const reviewer: HostReviewer = await writes.addReviewerAsync(addition, signal);

    assert.deepEqual(reviewer, new HostReviewer(new HostPerson("monalisa@fabrikam.test", null, null), 0, "No vote", false));
    assert.deepEqual([azure.urls(), azure.requests.map(t => t.init.method), azure.requests[1]?.header("Content-Type"), azure.requests[1]?.body],
      [[storageKeyUrl, reviewersUrl], [undefined, "POST"], "application/json", [{ id: personId }]]);
  });

  it("refuses as signed out for another organization than the token's, and asks to sign in again for a sign-in without code writes, asking nothing", async () => {
    const azure = new FakeAzure();
    const renewed = new FakeToken();
    renewed.token?.renew("access-1", false);

    const failures = [failureOf(await writesOf(azure, new FakeToken("azure-token", "contoso")).addReviewerAsync(addition, signal).then(() => null, (t: unknown) => t)),
      failureOf(await writesOf(azure, renewed).addReviewerAsync(addition, signal).then(() => null, (t: unknown) => t))];

    assert.deepEqual([failures, azure.requests.length], [[[FailureCode.Unauthorized, "Sign in to Azure DevOps first."], [FailureCode.Unauthorized,
      "Sign in to Azure DevOps again to allow replies, thread states and votes; the sign-in from before them can't make them."]], 0]);
  });

  it("says the token can't add reviewers or read people when Azure DevOps refuses, NotFound for a person or pull request it doesn't find, and Unavailable for an answer it can't read", async () => {
    const azure = new FakeAzure();
    azure.answer(storageKey(), FakeAzure.json({ message: "Access denied." }, 403), new Response(null, { status: 404 }), storageKey(),
      new Response(null, { status: 404 }), new Response(null, { status: 401 }), FakeAzure.json({ value: " " }), storageKey(),
      added("0b5c9e4e-7e3a-4bd8-8bd5-1c0d6f3a3c53"));
    const token = new FakeToken();
    const writes = writesOf(azure, token);

    const failures: unknown[] = [];
    for (let attempt = 0; attempt < 6; attempt++)
      failures.push(failureOf(await writes.addReviewerAsync(addition, signal).then(() => null, (t: unknown) => t)));

    const unreadable = [FailureCode.Unavailable, "Azure DevOps' answer couldn't be read."];
    assert.deepEqual([failures, token.refused], [[[FailureCode.Unauthorized, "The Azure DevOps token can't add reviewers; it needs the Code (Read & write) scope."],
      [FailureCode.NotFound, "Azure DevOps doesn't find that person or group in the organization."],
      [FailureCode.NotFound, "Azure DevOps doesn't show this pull request."], [FailureCode.Unauthorized, "The Azure DevOps token can't read the organization's people; it needs the Graph (Read) scope."], [FailureCode.Unavailable, "Azure DevOps' answer couldn't be read at $.value."], unreadable],
    ["azure-token", "azure-token"]]);
  });

  it("passes on the sign-out when Azure DevOps refuses the person's id read and the sign-in drops the token", async () => {
    const azure = new FakeAzure();
    azure.answer(new Response(null, { status: 401 }));
    const revoked = new FakeToken();
    revoked.answer("refusedAsync", async () => {
      revoked.answer("token", null);
    });

    const failure = failureOf(await writesOf(azure, revoked).addReviewerAsync(addition, signal).then(() => null, (t: unknown) => t));

    assert.deepEqual([failure, revoked.refused, azure.urls()], [[FailureCode.Unauthorized, "Sign in to Azure DevOps first."], ["azure-token"], [storageKeyUrl]]);
  });
});
