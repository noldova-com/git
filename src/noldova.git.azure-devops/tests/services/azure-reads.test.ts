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
import { BranchPullRequest, BranchQuery, CheckState, CommitQuery, FileChangeKind, HostBuild, HostChanges, HostCheck, HostComment, HostCommitComments, HostItem,
  HostPerson, HostPolicy, HostPullRequest, HostPullRequestCommit, HostPullRequestCommits, HostPullRequestConflicts, HostPullRequestFile, HostPullRequestFiles,
  HostPullRequestHead, HostPullRequestHeads, HostPullRequestList, HostPullRequestRow, HostPullRequestUpdate, HostPullRequestUpdates, HostReference,
  HostReviewer, HostReviewRequest, HostReviewRequestList, HostThread, HostWorkItem, HostWorkItemDetail, HostWorkItemLink, HostWorkItemList, HostWorkItemType,
  PolicyState, ReferenceKind, ReferenceState, RepositoryQuery, ReviewDecision, ThreadStatus, WorkItemCategory, WorkItemQuery, WorkItemScope,
  WorkItemsQuery } from "@noldova/git.hosting.protocol";
import { describe, it } from "vitest";

import { AzureCredential } from "../../src/models/azure-credential.ts";
import { FoundPerson } from "../../src/models/found-person.ts";
import { PeopleQuery } from "../../src/models/people-query.ts";
import { AzureApi } from "../../src/services/azure-api.ts";
import { AzureReads } from "../../src/services/azure-reads.ts";
import { FakeAzure, FakeToken } from "../fixtures/fake-azure.fixture.ts";

const signal: AbortSignal = new AbortController().signal;
const repositoryId: string = "3411ebc1-d5aa-464f-9615-0b527bc66719";
const projectId: string = "6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c";
const commit: string = "6dcb09b5b57875f334f61aebed695e2e4193db5e";
const reference: HostReference = new HostReference("git-azure-devops", "fabrikam", repositoryId, 12);
const page: string = "https://dev.azure.com/fabrikam/Web%20Site/_git/site/pullrequest/12";
const pullUrl: string = `https://dev.azure.com/fabrikam/_apis/git/repositories/${repositoryId}/pullrequests/12?api-version=7.1`;
const policiesUrl: string = `https://dev.azure.com/fabrikam/${projectId}/_apis/policy/evaluations?artifactId=`
  + `vstfs%3A%2F%2F%2FCodeReview%2FCodeReviewId%2F${projectId}%2F12&api-version=7.1-preview.1`;
const buildsUrl: string = `https://dev.azure.com/fabrikam/${projectId}/_apis/build/builds?branchName=refs%2Fpull%2F12%2Fmerge`
  + `&repositoryId=${repositoryId}&repositoryType=TfsGit&api-version=7.1`;
const commitsUrl: string = `https://dev.azure.com/fabrikam/_apis/git/repositories/${repositoryId}/pullRequests/12/commits?$top=100&api-version=7.1`;
const pullCommitsUrl: string = `https://dev.azure.com/fabrikam/_apis/git/repositories/${repositoryId}/pullRequests/12/commits?$top=251&api-version=7.1`;
const pullUpdatesUrl: string = `https://dev.azure.com/fabrikam/_apis/git/repositories/${repositoryId}/pullRequests/12/iterations?api-version=7.1`;
const pullChangesUrl = (iteration: number): string => `https://dev.azure.com/fabrikam/_apis/git/repositories/${repositoryId}/pullRequests/12/iterations/`
  + `${String(iteration)}/changes?$top=1001&$compareTo=0&api-version=7.1`;
const pullConflictsUrl: string = `https://dev.azure.com/fabrikam/_apis/git/repositories/${repositoryId}/pullRequests/12/conflicts?$top=101&api-version=7.1`;
const linksUrl: string = `https://dev.azure.com/fabrikam/_apis/git/repositories/${repositoryId}/pullRequests/12/workitems?api-version=7.1`;
const listUrl: string = "https://dev.azure.com/fabrikam/web/_apis/git/repositories/site/pullrequests?searchCriteria.sourceRefName=refs%2Fheads%2Ffeature%2Fsign-in"
  + "&searchCriteria.status=all&$top=1&api-version=7.1";
const queryUrl: string = "https://dev.azure.com/fabrikam/web/_apis/git/repositories/site/pullrequestquery?api-version=7.1";
const projectPullUrl = (number: number): string => `https://dev.azure.com/fabrikam/web/_apis/git/pullrequests/${String(number)}?api-version=7.1`;
const commitQuery: CommitQuery = new CommitQuery("dev.azure.com", "fabrikam/web/_git/site", commit);
const otherCommit: string = "7638417db6d59f3c431d3e1f261cc637155684cd";
const pullIterationsUrl: string = `https://dev.azure.com/fabrikam/_apis/git/repositories/${repositoryId}/pullRequests/12/iterations?api-version=7.1`;
const pulledBy = (): Response => FakeAzure.json({ results: [{ [commit]: [{ pullRequestId: 12 }] }, {}] });
const iterated = (): Response => FakeAzure.json({ value: [{ id: 1, sourceRefCommit: { commitId: otherCommit } }, { id: 2, sourceRefCommit: { commitId: commit } },
  { id: 3, sourceRefCommit: { commitId: commit } }] });

function said(count: number, changes: Readonly<Record<string, unknown>> = {}): Record<string, unknown>[] {
  return Array.from({ length: count }, (_t, i) => ({ id: i + 1, commentType: "text", content: `Comment ${i + 1}`, ...changes }));
}

function threadOn(iteration: number, comments: readonly Readonly<Record<string, unknown>>[]): Record<string, unknown> {
  return { id: iteration * 10, pullRequestThreadContext: { iterationContext: { firstComparingIteration: 1, secondComparingIteration: iteration } }, comments };
}

function pull(changes: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    pullRequestId: 12, status: "active", isDraft: false, title: "Add the sign-in page", creationDate: "2027-01-15T09:30:00Z",
    createdBy: { displayName: "Mona Lisa", uniqueName: "monalisa@fabrikam.com" }, sourceRefName: "refs/heads/feature/sign-in", targetRefName: "refs/heads/main",
    lastMergeSourceCommit: { commitId: commit },
    reviewers: [{ displayName: "Octo Cat", uniqueName: "octocat@fabrikam.com", vote: 5, isRequired: true }, { displayName: "[Web Site]\\Web Team",
      uniqueName: "vstfs:///Classification/TeamProject/7f3c2a10-0000-0000-0000-000000000003\\Web Team", isContainer: true, vote: 0 }],
    repository: { id: repositoryId, name: "site", project: { id: projectId, name: "Web Site" } },
    ...changes
  };
}

function evaluation(status: string, name: string, isBlocking: boolean, type: string = "fa4e907d-c16b-4a4c-9dfa-4906e5d171dd"): Record<string, unknown> {
  return { status, configuration: { isBlocking, type: { id: type, displayName: name } } };
}

function build(status: string, result: string | null, finished: boolean = result !== null, started: boolean = true): Record<string, unknown> {
  return {
    status, ...result === null ? {} : { result }, definition: { name: "site-ci" }, _links: { web: { href: "https://dev.azure.com/fabrikam/web/_build/results?buildId=7" } },
    ...started ? { startTime: "2027-01-15T09:31:00Z" } : {}, ...finished ? { finishTime: "2027-01-15T09:41:00Z" } : {}
  };
}

const personId: string = "d6245f20-2af8-44f4-9451-8107cb2767db";
const connectionUrl: string = "https://dev.azure.com/fabrikam/_apis/connectionData";
const reviewRequestsUrl: string = "https://dev.azure.com/fabrikam/web/_apis/git/repositories/site/pullrequests"
  + `?searchCriteria.reviewerId=${personId}&searchCriteria.status=active&$top=101&api-version=7.1`;
const connection = (): Response => FakeAzure.json({ authenticatedUser: { id: personId, providerDisplayName: "Mona Lisa" } });

function asking(vote: number, changes: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
  return pull({ reviewers: [{ id: "a1b2c3d4-0000-0000-0000-000000000001", uniqueName: "octocat@fabrikam.com", vote: 0 }, { uniqueName: "[web]\\Web Team", vote: 0 },
    { id: personId, uniqueName: "monalisa@fabrikam.com", vote }], ...changes });
}

const item: HostItem = new HostItem(reference, ReferenceKind.PullRequest, ReferenceState.Open, "Add the sign-in page", page,
  new HostPerson("monalisa@fabrikam.com", null, null), Date.parse("2027-01-15T09:30:00Z"), null, 0,
  new HostChanges(null, null, null, "feature/sign-in", "main", commit));

const workItemQuery: WorkItemQuery = new WorkItemQuery("git-azure-devops", "fabrikam", 42);
const workItemUrl: string = "https://dev.azure.com/fabrikam/_apis/wit/workitems/42?api-version=7.1";
const typeUrl: string = "https://dev.azure.com/fabrikam/Web%20Site/_apis/wit/workitemtypes/User%20Story?api-version=7.1";
const story: HostWorkItemType = new HostWorkItemType("User Story", "009CCC", "icon_book");

function workItem(fields: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 42,
    fields: {
      "System.TeamProject": "Web Site", "System.WorkItemType": "User Story", "System.Title": "Sign in with a token", "System.State": "Active",
      "System.AssignedTo": { displayName: "Mona Lisa", uniqueName: "monalisa@fabrikam.com" }, "System.IterationPath": "Web Site\\Sprint 3",
      "System.AreaPath": "Web Site\\Accounts", "System.Parent": 40, ...fields
    }
  };
}

function workItemType(name: string = "User Story"): Record<string, unknown> {
  return {
    name, color: "009CCC", icon: { id: "icon_book", url: "https://tfsprodcus3.visualstudio.com/_apis/wit/workItemIcons/icon_book" },
    states: [{ name: "New", color: "b2b2b2", category: "Proposed" }, { name: "Active", color: "007acc", category: "InProgress" },
      { name: "Closed", color: "339933", category: "Completed" }]
  };
}

const storyItem: HostWorkItem = new HostWorkItem("git-azure-devops", "fabrikam", "Web Site", 42, story, "Sign in with a token", "Active",
  WorkItemCategory.InProgress, "https://dev.azure.com/fabrikam/Web%20Site/_workitems/edit/42", new HostPerson("monalisa@fabrikam.com", null, null),
  "Web Site\\Sprint 3", "Web Site\\Accounts", 40);

const threadsUrl: string = `https://dev.azure.com/fabrikam/_apis/git/repositories/${repositoryId}/pullRequests/12/threads?api-version=7.1`;
const monalisa: HostPerson = new HostPerson("monalisa@fabrikam.com", null, null);

function comment(id: number, parent: number, content: string, changes: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id, parentCommentId: parent, author: { displayName: "Mona Lisa", uniqueName: "monalisa@fabrikam.com" }, content, publishedDate: "2027-01-15T10:00:00Z",
    lastUpdatedDate: "2027-01-15T10:00:00Z", commentType: "text", ...changes
  };
}

function thread(id: number, status: string | undefined, threadContext: Readonly<Record<string, unknown>> | null | undefined,
  comments: readonly Record<string, unknown>[]): Record<string, unknown> {
  return { id, status, threadContext, comments, publishedDate: "2027-01-15T10:00:00Z", isDeleted: false, properties: {} };
}

function note(id: number, parent: number | null, body: string): HostComment {
  return new HostComment(id, parent, monalisa, Date.parse("2027-01-15T10:00:00Z"), body);
}

function failureOf(error: unknown): string | null {
  return error instanceof MethodFailureException ? error.failure.code : null;
}

describe("AzureReads", () => {
  it("reads a pull request as an item, with its project's page, its author's name and its branches, and no counts Azure DevOps doesn't give", async () => {
    const azure = new FakeAzure();
    azure.answer(FakeAzure.json(pull()));
    const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());

    const read: HostItem | null = await reads.readReferenceAsync(reference, signal);

    assert.deepEqual([read, azure.urls()], [item, [pullUrl]]);
  });

  it("reads a draft, a completed pull request as merged and an abandoned one as closed, dated when it closed, and one with no creator", async () => {
    const azure = new FakeAzure();
    azure.answer(FakeAzure.json(pull({ isDraft: true })), FakeAzure.json(pull({ status: "completed", closedDate: "2027-01-16T10:00:00Z" })),
      FakeAzure.json(pull({ status: "abandoned", closedDate: "2027-01-17T10:00:00Z", sourceRefName: "feature/raw" })),
      FakeAzure.json({ ...pull(), createdBy: undefined }));
    const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());

    const read: (HostItem | null)[] = [];
    for (let index = 0; index < 4; index++)
      read.push(await reads.readReferenceAsync(reference, signal));

    assert.deepEqual(read.map(t => [t?.state, t?.closedAt, t?.changes?.headBranch, t?.author?.login ?? null]), [
      [ReferenceState.Draft, null, "feature/sign-in", "monalisa@fabrikam.com"],
      [ReferenceState.Merged, Date.parse("2027-01-16T10:00:00Z"), "feature/sign-in", "monalisa@fabrikam.com"],
      [ReferenceState.Closed, Date.parse("2027-01-17T10:00:00Z"), "feature/raw", "monalisa@fabrikam.com"],
      [ReferenceState.Open, null, "feature/sign-in", null]
    ]);
  });

  it("reads nothing when signed out, for another host, an organization or repository id it can't name, or a pull request Azure DevOps can't show", async () => {
    const azure = new FakeAzure();
    azure.answer(new Response(null, { status: 404 }), new Response(null, { status: 404 }));
    const signedIn = new AzureReads(new AzureApi(azure.fetch), new FakeToken());
    const signedOut = new AzureReads(new AzureApi(azure.fetch), new FakeToken(null));

    const read: unknown[] = [
      await signedOut.readReferenceAsync(reference, signal), await signedOut.readPullRequestAsync(reference, signal),
      await signedIn.readReferenceAsync(new HostReference("git-github", "octocat", "hello-world", 12), signal),
      await signedIn.readReferenceAsync(new HostReference("git-azure-devops", "fab_rikam", repositoryId, 12), signal),
      await signedIn.readPullRequestAsync(new HostReference("git-azure-devops", "fabrikam", "site", 12), signal),
      await signedIn.readReferenceAsync(reference, signal), await signedIn.readPullRequestAsync(reference, signal)
    ];

    assert.deepEqual([read, azure.requests.length], [[null, null, null, null, null, null, null], 2]);
  });

  it("reads a pull request with its reviewers' votes, its policies, its builds, its work items' state categories, a state its type doesn't list as proposed, and"
    + " whether it completes by itself", async () => {
    const azure = new FakeAzure();
    azure.answer(FakeAzure.json(pull({ autoCompleteSetBy: { uniqueName: "monalisa@fabrikam.com" }, completionOptions: { mergeStrategy: "squash" },
      description: "Readers see **due dates**." })),
      FakeAzure.json({ value: [evaluation("approved", "Minimum number of reviewers", true), evaluation("running", "Build", false, "0609b952-1397-4640-95ec-e00a01b2c241")] }),
      FakeAzure.json({ value: [build("completed", "succeeded"), build("inProgress", null)] }), FakeAzure.json({ count: 5, value: Array.from({ length: 5 }, () => ({})) }),
      FakeAzure.json({ value: [{ id: "7521" }, { id: "7499" }] }),
      FakeAzure.json({ value: [workItem({ "System.Title": "Export notes as Markdown files" }), { ...workItem({ "System.WorkItemType": "Bug", "System.State": "Triaged" }), id: 7499 }] }),
      FakeAzure.json(workItemType()), FakeAzure.json({ ...workItemType("Bug"), color: "CC293D", icon: { id: "icon_insect" } }));
    const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());

    const read: HostPullRequest | null = await reads.readPullRequestAsync(reference, signal);

    assert.deepEqual(read, new HostPullRequest(item, [
      new HostReviewer(new HostPerson("octocat@fabrikam.com", null, null), 0.5, "Approved with suggestions", true),
      new HostReviewer(new HostPerson("[Web Site]\\Web Team", null, null), 0, "No vote", false)
    ], [
      new HostPolicy("Minimum number of reviewers", PolicyState.Approved, true, null), new HostPolicy("Build", PolicyState.Running, false, null)
    ], [
      new HostBuild("site-ci", CheckState.Succeeded, "https://dev.azure.com/fabrikam/web/_build/results?buildId=7", Date.parse("2027-01-15T09:31:00Z"),
        Date.parse("2027-01-15T09:41:00Z")),
      new HostBuild("site-ci", CheckState.Running, "https://dev.azure.com/fabrikam/web/_build/results?buildId=7", Date.parse("2027-01-15T09:31:00Z"), null)
    ], true, "Readers see **due dates**.", 5, [
      new HostWorkItemLink(42, "Export notes as Markdown files", story, "Active", WorkItemCategory.InProgress,
        "https://dev.azure.com/fabrikam/Web%20Site/_workitems/edit/42"),
      new HostWorkItemLink(7499, "Sign in with a token", new HostWorkItemType("Bug", "CC293D", "icon_insect"), "Triaged", WorkItemCategory.Proposed,
        "https://dev.azure.com/fabrikam/Web%20Site/_workitems/edit/7499")
    ], "squash"));
    assert.deepEqual(azure.urls(), [pullUrl, policiesUrl, buildsUrl, commitsUrl, linksUrl,
      "https://dev.azure.com/fabrikam/_apis/wit/workitems?ids=7521,7499&fields=System.Title,System.State,System.WorkItemType,System.TeamProject&api-version=7.1",
      typeUrl, "https://dev.azure.com/fabrikam/Web%20Site/_apis/wit/workitemtypes/Bug?api-version=7.1"]);
  });

  it("names no auto-complete merge type without auto-complete, without completion options or when the options name none", async () => {
    const azure = new FakeAzure();
    const setBy = { uniqueName: "monalisa@fabrikam.com" };
    for (const changes of [{ completionOptions: { mergeStrategy: "squash" } }, { autoCompleteSetBy: setBy }, { autoCompleteSetBy: setBy, completionOptions: {
      deleteSourceBranch: true } }])
      azure.answer(FakeAzure.json(pull(changes)), FakeAzure.json({ value: [] }), FakeAzure.json({ value: [] }), FakeAzure.json({ value: [] }), FakeAzure.json({ value: [] }));
    const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());

    const read: readonly (HostPullRequest | null)[] = [await reads.readPullRequestAsync(reference, signal), await reads.readPullRequestAsync(reference, signal),
      await reads.readPullRequestAsync(reference, signal)];

    assert.deepEqual(read.map(t => [t?.isAutoComplete, t?.autoCompleteMergeType]), [[false, null], [true, null], [true, null]]);
  });

  it("names a group reviewer by its display name, not the descriptor Azure DevOps gives as its unique name, which stays only for a blank display name or a person", async () => {
    const azure = new FakeAzure();
    const descriptor: string = "vstfs:///Framework/IdentityDomain/5d2f0c11-0000-0000-0000-000000000004\\sample_qa";
    azure.answer(FakeAzure.json(pull({ reviewers: [{ displayName: "[Sample]\\sample_qa", uniqueName: descriptor, isContainer: true, vote: 0 },
      { displayName: " ", uniqueName: descriptor, isContainer: true, vote: 0 }, { displayName: "Octo Cat", uniqueName: "octocat@fabrikam.com", isContainer: false, vote: 0 }] })),
      FakeAzure.json({ value: [] }), FakeAzure.json({ value: [] }), FakeAzure.json({ value: [] }), FakeAzure.json({ value: [] }));
    const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());

    const read: HostPullRequest | null = await reads.readPullRequestAsync(reference, signal);

    assert.deepEqual(read?.reviewers.map(t => t.person.login), ["[Sample]\\sample_qa", descriptor, "octocat@fabrikam.com"]);
  });

  it("reads each build's number and, for a build policy, the number of the build its evaluation ran, none for a build it didn't read or a policy that ran none",
    async () => {
      const azure = new FakeAzure();
      const buildType: string = "0609b952-1397-4640-95ec-e00a01b2c241";
      azure.answer(FakeAzure.json(pull()), FakeAzure.json({ value: [
        { ...evaluation("approved", "Build", true, buildType), context: { buildId: 71, buildDefinitionId: 3 } },
        { ...evaluation("running", "Build", false, buildType), context: { buildId: 72 } },
        { ...evaluation("queued", "Build", false, buildType), context: { buildId: 99 } },
        { ...evaluation("queued", "Build", false, buildType), context: null },
        evaluation("approved", "Minimum number of reviewers", true)
      ] }), FakeAzure.json({ value: [{ ...build("completed", "succeeded"), id: 71, buildNumber: "20261121.4" }, { ...build("inProgress", null), id: 72, buildNumber: "20261121.5" },
        build("inProgress", null)] }), FakeAzure.json({ value: [] }), FakeAzure.json({ value: [] }));
      const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());

      const read: HostPullRequest | null = await reads.readPullRequestAsync(reference, signal);

      assert.deepEqual([read?.policies.map(t => t.buildNumber), read?.builds.map(t => t.number)],
        [["20261121.4", "20261121.5", null, null, null], ["20261121.4", "20261121.5", null]]);
    });

  it("names each vote, policy state and build state Azure DevOps answers, and one it doesn't know", async () => {
    const azure = new FakeAzure();
    const votes: readonly number[] = [10, 5, 0, -5, -10, 3];
    azure.answer(FakeAzure.json(pull({ reviewers: votes.map(t => ({ uniqueName: "octocat@fabrikam.com", vote: t })) })),
      FakeAzure.json({ value: ["queued", "running", "approved", "rejected", "notApplicable", "broken"].map(t => evaluation(t, "Policy", true)) }),
      FakeAzure.json({ value: [build("notStarted", null, false, false), build("inProgress", null), build("cancelling", null), build("completed", "succeeded"),
        build("completed", "partiallySucceeded"), build("completed", "canceled", true, false), build("completed", "failed"), build("completed", "unknown")] }),
      FakeAzure.json({ value: [] }), FakeAzure.json({ value: [] }));
    const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());

    const read: HostPullRequest | null = await reads.readPullRequestAsync(reference, signal);

    assert.deepEqual(read?.reviewers.map(t => [t.vote, t.voteLabel]), [[1, "Approved"], [0.5, "Approved with suggestions"], [0, "No vote"],
      [-0.5, "Waiting for the author"], [-1, "Rejected"], [0.3, "Voted 3"]]);
    assert.deepEqual(read?.policies.map(t => t.state), [PolicyState.Queued, PolicyState.Running, PolicyState.Approved, PolicyState.Rejected,
      PolicyState.NotApplicable, PolicyState.Rejected]);
    assert.deepEqual(read?.builds.map(t => [t.state, t.startedAt === null, t.finishedAt === null]), [[CheckState.Queued, true, true],
      [CheckState.Running, false, true], [CheckState.Running, false, true], [CheckState.Succeeded, false, false], [CheckState.Neutral, false, false],
      [CheckState.Neutral, true, false], [CheckState.Failed, false, false], [CheckState.Failed, false, false]]);
    assert.deepEqual([read?.isAutoComplete, read?.description, read?.commitCount, read?.workItems], [false, "", 0, []]);
  });

  it("reads a pull request with no policies, builds, commit count or work items when Azure DevOps can't show them", async () => {
    const azure = new FakeAzure();
    azure.answer(FakeAzure.json(pull()), new Response(null, { status: 404 }), new Response(null, { status: 404 }), new Response(null, { status: 404 }),
      new Response(null, { status: 404 }));
    const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());

    const read: HostPullRequest | null = await reads.readPullRequestAsync(reference, signal);

    assert.deepEqual([read?.policies, read?.builds, read?.commitCount, read?.workItems], [[], [], null, []]);
  });

  it("counts no commits past a page of 100, reads each work item type once, and reads none when the linked items are gone", async () => {
    const azure = new FakeAzure();
    azure.answer(FakeAzure.json(pull()), FakeAzure.json({ value: [] }), FakeAzure.json({ value: [] }), FakeAzure.json({ value: Array.from({ length: 100 }, () => ({})) }),
      FakeAzure.json({ value: [{ id: "42" }, { id: "43" }] }), FakeAzure.json({ value: [workItem(), { ...workItem(), id: 43 }] }), FakeAzure.json(workItemType()));
    azure.answer(FakeAzure.json(pull()), FakeAzure.json({ value: [] }), FakeAzure.json({ value: [] }), FakeAzure.json({ value: [] }),
      FakeAzure.json({ value: [{ id: "44" }] }), new Response(null, { status: 404 }));
    const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());

    const read = [await reads.readPullRequestAsync(reference, signal), await reads.readPullRequestAsync(reference, signal)];

    assert.deepEqual(read.map(t => [t?.commitCount, t?.workItems.map(w => w.id)]), [[null, [42, 43]], [0, []]]);
    assert.equal(azure.urls().filter(t => t === typeUrl).length, 1);
  });

  it("fails as Unavailable for a linked work item whose id isn't a number", async () => {
    const azure = new FakeAzure();
    azure.answer(FakeAzure.json(pull()), FakeAzure.json({ value: [] }), FakeAzure.json({ value: [] }), FakeAzure.json({ value: [] }),
      FakeAzure.json({ value: [{ id: "7521a" }] }));
    const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());

    assert.equal(failureOf(await reads.readPullRequestAsync(reference, signal).then(() => null, (t: unknown) => t)), FailureCode.Unavailable);
  });

  it("reads a pull request's threads with each one's state, file and line, keeping only people's text comments that aren't deleted", async () => {
    const azure = new FakeAzure();
    azure.answer(FakeAzure.json({ value: [
      thread(1, "active", { filePath: "/src/sign in.ts", rightFileStart: { line: 14, offset: 1 }, rightFileEnd: { line: 16, offset: 1 } },
        [comment(1, 0, "Should this **respect** local times?"), comment(2, 1, "Yes, fixed.", { publishedDate: "2027-01-15T10:05:00Z" }),
          comment(3, 1, "Never mind.", { isDeleted: true })]),
      thread(2, "fixed", { filePath: "/README.md", rightFileStart: null, leftFileStart: { line: 3, offset: 1 } }, [comment(1, 0, "Typo here.")]),
      thread(3, undefined, null, [comment(1, 0, "Ready once CI passes.")]),
      thread(4, "wontFix", { filePath: "/site.css" }, [{ ...comment(1, 0, "Rename this file."), parentCommentId: undefined }]),
      thread(5, "byDesign", undefined, [comment(1, 0, "Keep it.")]), thread(6, "pending", undefined, [comment(1, 0, "Waiting on design.")]),
      thread(7, "closed", undefined, [comment(1, 0, "Out of scope.")]), thread(8, "unknown", undefined, [comment(1, 0, "Noted.")]),
      thread(9, "active", null, [comment(1, 0, "Mona Lisa voted 10", { commentType: "system" })]),
      { ...thread(10, "active", null, [comment(1, 0, "Gone.")]), isDeleted: true },
      thread(11, "active", null, [comment(1, 0, "  "), comment(2, 0, "Edited away.", { content: undefined })])
    ] }));
    const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());

    const threads: readonly HostThread[] = await reads.readPullRequestThreadsAsync(reference, signal);

    assert.deepEqual(threads, [
      new HostThread(1, ThreadStatus.Active, "/src/sign in.ts", 14, [note(1, null, "Should this **respect** local times?"),
        new HostComment(2, 1, monalisa, Date.parse("2027-01-15T10:05:00Z"), "Yes, fixed.")]),
      new HostThread(2, ThreadStatus.Resolved, "/README.md", 3, [note(1, null, "Typo here.")]),
      new HostThread(3, ThreadStatus.None, null, null, [note(1, null, "Ready once CI passes.")]),
      new HostThread(4, ThreadStatus.WontFix, "/site.css", null, [note(1, null, "Rename this file.")]),
      new HostThread(5, ThreadStatus.ByDesign, null, null, [note(1, null, "Keep it.")]),
      new HostThread(6, ThreadStatus.Pending, null, null, [note(1, null, "Waiting on design.")]),
      new HostThread(7, ThreadStatus.Closed, null, null, [note(1, null, "Out of scope.")]),
      new HostThread(8, ThreadStatus.None, null, null, [note(1, null, "Noted.")])
    ]);
    assert.deepEqual(azure.urls(), [threadsUrl]);
  });

  it("answers no threads signed out, for another host, organization or repository id, or a pull request Azure DevOps can't show", async () => {
    const azure = new FakeAzure();
    azure.answer(new Response(null, { status: 404 }));
    const signedIn = new AzureReads(new AzureApi(azure.fetch), new FakeToken());

    const read: (readonly HostThread[])[] = [
      await new AzureReads(new AzureApi(azure.fetch), new FakeToken(null)).readPullRequestThreadsAsync(reference, signal),
      await signedIn.readPullRequestThreadsAsync(new HostReference("git-github", "octocat", "hello-world", 12), signal),
      await signedIn.readPullRequestThreadsAsync(new HostReference("git-azure-devops", "contoso", repositoryId, 12), signal),
      await signedIn.readPullRequestThreadsAsync(new HostReference("git-azure-devops", "fabrikam", "site", 12), signal),
      await signedIn.readPullRequestThreadsAsync(reference, signal)
    ];

    assert.deepEqual([read, azure.urls()], [[[], [], [], [], []], [threadsUrl]]);
  });

  it("signs out the token refused for the threads and fails as Unauthorized, and fails an unreadable thread as Unavailable", async () => {
    const azure = new FakeAzure();
    azure.answer(new Response(null, { status: 401 }), FakeAzure.json({ value: "none" }),
      FakeAzure.json({ value: [thread(1, "active", null, [{ ...comment(1, 0, "Fix"), author: undefined }])] }),
      FakeAzure.json({ value: [thread(1, "active", { filePath: "/a.ts", rightFileStart: { line: 0, offset: 1 } }, [comment(1, 0, "Fix")])] }));
    const token = new FakeToken();
    const reads = new AzureReads(new AzureApi(azure.fetch), token);

    const failures: (string | null)[] = [];
    for (let i = 0; i < 4; i++)
      failures.push(failureOf(await reads.readPullRequestThreadsAsync(reference, signal).then(() => null, (t: unknown) => t)));

    assert.deepEqual([failures, token.refused], [[FailureCode.Unauthorized, FailureCode.Unavailable, FailureCode.Unavailable, FailureCode.Unavailable],
      ["azure-token"]]);
  });

  it("drops the threads read for a token that changed while they were read", async () => {
    const azure = new FakeAzure();
    const token = new FakeToken();
    const release = azure.hold();
    const reads = new AzureReads(new AzureApi(azure.fetch), token);

    const reading = reads.readPullRequestThreadsAsync(reference, signal);
    await azure.askedAsync(1);
    token.answer("token", AzureCredential.ofToken("other-token"));
    release(FakeAzure.json({ value: [thread(1, "active", null, [comment(1, 0, "Fix")])] }));

    assert.deepEqual(await reading, []);
  });

  it("reads the commits a pull request brings, newest first, as their ids, first lines, authors and times, keeping 250 of more", async () => {
    const azure = new FakeAzure();
    const at: string = "2027-01-15T09:30:00Z";
    azure.answer(FakeAzure.json({ value: [{ commitId: commit, comment: "Fix the sign-in\r\n\r\nLonger text", author: { name: "Mona Lisa", date: at } },
      { commitId: otherCommit, author: { name: "Hubot", date: at } }] }),
    FakeAzure.json({ value: Array.from({ length: 251 }, () => ({ commitId: commit, comment: "Step", author: { name: "Mona Lisa", date: at } })) }));
    const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());

    const read: HostPullRequestCommits[] = [await reads.readPullRequestCommitsAsync(reference, signal), await reads.readPullRequestCommitsAsync(reference, signal)];

    assert.deepEqual(read[0], new HostPullRequestCommits([new HostPullRequestCommit(commit, "Fix the sign-in", "Mona Lisa", Date.parse(at)),
      new HostPullRequestCommit(otherCommit, "", "Hubot", Date.parse(at))], false));
    assert.deepEqual([read[1]?.commits.length, read[1]?.hasMore], [250, true]);
    assert.deepEqual(azure.urls(), [pullCommitsUrl, pullCommitsUrl]);
  });

  it("answers no commits signed out, for another host, organization or repository id, or a pull request Azure DevOps can't show", async () => {
    const azure = new FakeAzure();
    azure.answer(new Response(null, { status: 404 }));
    const signedIn = new AzureReads(new AzureApi(azure.fetch), new FakeToken());
    const none = new HostPullRequestCommits([], false);

    const read: HostPullRequestCommits[] = [
      await new AzureReads(new AzureApi(azure.fetch), new FakeToken(null)).readPullRequestCommitsAsync(reference, signal),
      await signedIn.readPullRequestCommitsAsync(new HostReference("git-github", "octocat", "hello-world", 12), signal),
      await signedIn.readPullRequestCommitsAsync(new HostReference("git-azure-devops", "contoso", repositoryId, 12), signal),
      await signedIn.readPullRequestCommitsAsync(new HostReference("git-azure-devops", "fabrikam", "site", 12), signal),
      await signedIn.readPullRequestCommitsAsync(reference, signal)
    ];

    assert.deepEqual([read, azure.urls()], [[none, none, none, none, none], [pullCommitsUrl]]);
  });

  it("signs out the token refused for the commits and fails as Unauthorized, and fails an unreadable commit as Unavailable", async () => {
    const azure = new FakeAzure();
    azure.answer(new Response(null, { status: 401 }), FakeAzure.json({ value: "none" }),
      FakeAzure.json({ value: [{ commitId: commit, comment: "Fix", author: { name: " ", date: "2027-01-15T09:30:00Z" } }] }),
      FakeAzure.json({ value: [{ commitId: commit, comment: "Fix", author: { name: "Mona Lisa", date: "never" } }] }));
    const token = new FakeToken();
    const reads = new AzureReads(new AzureApi(azure.fetch), token);

    const failures: (string | null)[] = [];
    for (let i = 0; i < 4; i++)
      failures.push(failureOf(await reads.readPullRequestCommitsAsync(reference, signal).then(() => null, (t: unknown) => t)));

    assert.deepEqual([failures, token.refused], [[FailureCode.Unauthorized, FailureCode.Unavailable, FailureCode.Unavailable, FailureCode.Unavailable],
      ["azure-token"]]);
  });

  it("drops the commits read for a token that changed while they were read", async () => {
    const azure = new FakeAzure();
    const token = new FakeToken();
    const release = azure.hold();
    const reads = new AzureReads(new AzureApi(azure.fetch), token);

    const reading = reads.readPullRequestCommitsAsync(reference, signal);
    await azure.askedAsync(1);
    token.answer("token", AzureCredential.ofToken("other-token"));
    release(FakeAzure.json({ value: [{ commitId: commit, comment: "Fix", author: { name: "Mona Lisa", date: "2027-01-15T09:30:00Z" } }] }));

    assert.deepEqual(await reading, new HostPullRequestCommits([], false));
  });

  it("reads a pull request's pushes newest first, with who pushed, when, and the head and common commits, keeping the newest 100 of more", async () => {
    const azure = new FakeAzure();
    const at: string = "2027-01-15T09:30:00Z";
    azure.answer(FakeAzure.json({ value: [
      { id: 1, author: { uniqueName: "monalisa@fabrikam.com" }, createdDate: at, sourceRefCommit: { commitId: otherCommit }, commonRefCommit: { commitId: commit } },
      { id: 2, createdDate: at, sourceRefCommit: { commitId: commit } }] }),
    FakeAzure.json({ value: Array.from({ length: 101 }, (_, i) => ({ id: i + 1, createdDate: at, sourceRefCommit: { commitId: commit } })) }));
    const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());

    const read: HostPullRequestUpdates[] = [await reads.readPullRequestUpdatesAsync(reference, signal), await reads.readPullRequestUpdatesAsync(reference, signal)];

    assert.deepEqual(read[0], new HostPullRequestUpdates([new HostPullRequestUpdate(2, null, Date.parse(at), commit, null),
      new HostPullRequestUpdate(1, monalisa, Date.parse(at), otherCommit, commit)], false));
    assert.deepEqual([read[1]?.updates.length, read[1]?.updates[0]?.number, read[1]?.updates[99]?.number, read[1]?.hasMore], [100, 101, 2, true]);
    assert.deepEqual(azure.urls(), [pullUpdatesUrl, pullUpdatesUrl]);
  });

  it("answers no pushes signed out, for another host, organization or repository id, or a pull request Azure DevOps can't show", async () => {
    const azure = new FakeAzure();
    azure.answer(new Response(null, { status: 404 }));
    const signedIn = new AzureReads(new AzureApi(azure.fetch), new FakeToken());
    const none = new HostPullRequestUpdates([], false);

    const read: HostPullRequestUpdates[] = [
      await new AzureReads(new AzureApi(azure.fetch), new FakeToken(null)).readPullRequestUpdatesAsync(reference, signal),
      await signedIn.readPullRequestUpdatesAsync(new HostReference("git-github", "octocat", "hello-world", 12), signal),
      await signedIn.readPullRequestUpdatesAsync(new HostReference("git-azure-devops", "contoso", repositoryId, 12), signal),
      await signedIn.readPullRequestUpdatesAsync(new HostReference("git-azure-devops", "fabrikam", "site", 12), signal),
      await signedIn.readPullRequestUpdatesAsync(reference, signal)
    ];

    assert.deepEqual([read, azure.urls()], [[none, none, none, none, none], [pullUpdatesUrl]]);
  });

  it("signs out the token refused for the pushes and fails as Unauthorized, and fails an unreadable push as Unavailable", async () => {
    const azure = new FakeAzure();
    const at: string = "2027-01-15T09:30:00Z";
    azure.answer(new Response(null, { status: 401 }), FakeAzure.json({ value: "none" }),
      FakeAzure.json({ value: [{ id: 1, createdDate: at }] }),
      FakeAzure.json({ value: [{ id: 0, createdDate: at, sourceRefCommit: { commitId: commit } }] }));
    const token = new FakeToken();
    const reads = new AzureReads(new AzureApi(azure.fetch), token);

    const failures: (string | null)[] = [];
    for (let i = 0; i < 4; i++)
      failures.push(failureOf(await reads.readPullRequestUpdatesAsync(reference, signal).then(() => null, (t: unknown) => t)));

    assert.deepEqual([failures, token.refused], [[FailureCode.Unauthorized, FailureCode.Unavailable, FailureCode.Unavailable, FailureCode.Unavailable],
      ["azure-token"]]);
  });

  it("drops the pushes read for a token that changed while they were read", async () => {
    const azure = new FakeAzure();
    const token = new FakeToken();
    const release = azure.hold();
    const reads = new AzureReads(new AzureApi(azure.fetch), token);

    const reading = reads.readPullRequestUpdatesAsync(reference, signal);
    await azure.askedAsync(1);
    token.answer("token", AzureCredential.ofToken("other-token"));
    release(FakeAzure.json({ value: [{ id: 1, createdDate: "2027-01-15T09:30:00Z", sourceRefCommit: { commitId: commit } }] }));

    assert.deepEqual(await reading, new HostPullRequestUpdates([], false));
  });

  it("reads the files the latest push changes against the target branch, paths and kinds only, leaving out folders, with its commits, keeping 1000 of more, and "
    + "says there are more when a full list holds folders",
    async () => {
      const azure = new FakeAzure();
      const at: string = "2027-01-15T09:30:00Z";
      const pushes = (): Response => FakeAzure.json({ value: [{ id: 1, createdDate: at, sourceRefCommit: { commitId: otherCommit } },
        { id: 2, createdDate: at, sourceRefCommit: { commitId: commit }, commonRefCommit: { commitId: otherCommit } }] });
      azure.answer(pushes(), FakeAzure.json({ changeEntries: [
        { item: { path: "/src", gitObjectType: "tree" }, changeType: "add" },
        { item: { path: "/src/new.ts", gitObjectType: "blob" }, changeType: "add" },
        { item: { path: "/src/app.ts" }, changeType: "edit" },
        { item: { path: "/old.md" }, changeType: "delete" },
        { item: { path: "/docs/guide.md" }, changeType: "edit, rename", originalPath: "/guide.md" },
        { item: { path: "/docs/notes.md" }, changeType: "rename" }] }),
      pushes(), FakeAzure.json({ changeEntries: Array.from({ length: 1001 }, (_, i) => ({ item: { path: `/f${String(i)}.ts` }, changeType: "edit" })) }),
      pushes(), FakeAzure.json({ changeEntries: Array.from({ length: 1001 }, (_, i) => ({ item: { path: `/d${String(i)}`, gitObjectType: i < 40 ? "tree" : "blob" },
        changeType: "add" })) }));
      const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());

      const read: HostPullRequestFiles[] = [await reads.readPullRequestChangesAsync(reference, signal), await reads.readPullRequestChangesAsync(reference, signal),
        await reads.readPullRequestChangesAsync(reference, signal)];

      assert.deepEqual(read[0], new HostPullRequestFiles(commit, otherCommit, [new HostPullRequestFile("src/new.ts", FileChangeKind.Added, null),
        new HostPullRequestFile("src/app.ts", FileChangeKind.Modified, null), new HostPullRequestFile("old.md", FileChangeKind.Deleted, null),
        new HostPullRequestFile("docs/guide.md", FileChangeKind.Renamed, "guide.md"), new HostPullRequestFile("docs/notes.md", FileChangeKind.Modified, null)], false));
      assert.deepEqual([read[1]?.files.length, read[1]?.files[999]?.path, read[1]?.hasMore], [1000, "f999.ts", true]);
      assert.deepEqual([read[2]?.files.length, read[2]?.files[0]?.path, read[2]?.hasMore], [961, "d40", true]);
      assert.deepEqual(azure.urls(), [pullUpdatesUrl, pullChangesUrl(2), pullUpdatesUrl, pullChangesUrl(2), pullUpdatesUrl, pullChangesUrl(2)]);
    });

  it("reads a deleted file by its old path when its entry's item names none, and leaves out an entry that names no path", async () => {
    const azure = new FakeAzure();
    azure.answer(FakeAzure.json({ value: [{ id: 2, createdDate: "2027-01-15T09:30:00Z", sourceRefCommit: { commitId: commit } }] }),
      FakeAzure.json({ changeEntries: [
        { item: { path: "/src/app.ts" }, changeType: "edit" },
        { item: { objectId: otherCommit }, changeType: "delete", originalPath: "/src/old.ts" },
        { item: { objectId: otherCommit }, changeType: "rename", originalPath: "/docs/moved.md" },
        { item: { objectId: otherCommit }, changeType: "edit" }] }));
    const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());

    const read: HostPullRequestFiles = await reads.readPullRequestChangesAsync(reference, signal);

    assert.deepEqual(read, new HostPullRequestFiles(commit, null, [new HostPullRequestFile("src/app.ts", FileChangeKind.Modified, null),
      new HostPullRequestFile("src/old.ts", FileChangeKind.Deleted, null), new HostPullRequestFile("docs/moved.md", FileChangeKind.Modified, null)], false));
  });

  it("answers no files signed out, for another host, organization or repository id, a pull request Azure DevOps can't show, or one with no pushes", async () => {
    const azure = new FakeAzure();
    azure.answer(new Response(null, { status: 404 }), FakeAzure.json({ value: [] }),
      FakeAzure.json({ value: [{ id: 3, createdDate: "2027-01-15T09:30:00Z", sourceRefCommit: { commitId: commit } }] }), new Response(null, { status: 404 }));
    const signedIn = new AzureReads(new AzureApi(azure.fetch), new FakeToken());
    const none = new HostPullRequestFiles(null, null, [], false);

    const read: HostPullRequestFiles[] = [
      await new AzureReads(new AzureApi(azure.fetch), new FakeToken(null)).readPullRequestChangesAsync(reference, signal),
      await signedIn.readPullRequestChangesAsync(new HostReference("git-github", "octocat", "hello-world", 12), signal),
      await signedIn.readPullRequestChangesAsync(new HostReference("git-azure-devops", "contoso", repositoryId, 12), signal),
      await signedIn.readPullRequestChangesAsync(new HostReference("git-azure-devops", "fabrikam", "site", 12), signal),
      await signedIn.readPullRequestChangesAsync(reference, signal),
      await signedIn.readPullRequestChangesAsync(reference, signal),
      await signedIn.readPullRequestChangesAsync(reference, signal)
    ];

    assert.deepEqual([read, azure.urls()], [[none, none, none, none, none, none, none], [pullUpdatesUrl, pullUpdatesUrl, pullUpdatesUrl, pullChangesUrl(3)]]);
  });

  it("signs out the token refused for the files and fails as Unauthorized, and fails an unreadable push or change as Unavailable", async () => {
    const azure = new FakeAzure();
    const pushes = (): Response => FakeAzure.json({ value: [{ id: 1, createdDate: "2027-01-15T09:30:00Z", sourceRefCommit: { commitId: commit } }] });
    azure.answer(new Response(null, { status: 401 }), FakeAzure.json({ value: [{ id: 1 }] }),
      pushes(), FakeAzure.json({ changeEntries: [{ changeType: "edit" }] }),
      pushes(), FakeAzure.json({ changeEntries: [{ item: { path: "/" }, changeType: "edit" }] }));
    const token = new FakeToken();
    const reads = new AzureReads(new AzureApi(azure.fetch), token);

    const failures: (string | null)[] = [];
    for (let i = 0; i < 4; i++)
      failures.push(failureOf(await reads.readPullRequestChangesAsync(reference, signal).then(() => null, (t: unknown) => t)));

    assert.deepEqual([failures, token.refused], [[FailureCode.Unauthorized, FailureCode.Unavailable, FailureCode.Unavailable, FailureCode.Unavailable],
      ["azure-token"]]);
  });

  it("drops the files read for a token that changed while they were read", async () => {
    const azure = new FakeAzure();
    const token = new FakeToken();
    const release = azure.hold();
    const reads = new AzureReads(new AzureApi(azure.fetch), token);

    const reading = reads.readPullRequestChangesAsync(reference, signal);
    await azure.askedAsync(1);
    token.answer("token", AzureCredential.ofToken("other-token"));
    release(FakeAzure.json({ value: [] }));

    assert.deepEqual(await reading, new HostPullRequestFiles(null, null, [], false));
  });

  it("reads the paths of a pull request's conflicts, keeping 100 of more", async () => {
    const azure = new FakeAzure();
    azure.answer(FakeAzure.json({ value: [{ conflictId: 1, conflictPath: "/src/app.ts", conflictType: "editEdit" }, { conflictId: 2, conflictPath: "/README.md" }] }),
      FakeAzure.json({ value: Array.from({ length: 101 }, (_, i) => ({ conflictId: i, conflictPath: `/f${String(i)}.ts` })) }));
    const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());

    const read: HostPullRequestConflicts[] = [await reads.readPullRequestConflictsAsync(reference, signal),
      await reads.readPullRequestConflictsAsync(reference, signal)];

    assert.deepEqual(read[0], new HostPullRequestConflicts(["src/app.ts", "README.md"], false));
    assert.deepEqual([read[1]?.paths.length, read[1]?.paths[99], read[1]?.hasMore], [100, "f99.ts", true]);
    assert.deepEqual(azure.urls(), [pullConflictsUrl, pullConflictsUrl]);
  });

  it("answers no conflicts signed out, for another host, organization or repository id, or a pull request Azure DevOps can't show", async () => {
    const azure = new FakeAzure();
    azure.answer(new Response(null, { status: 404 }));
    const signedIn = new AzureReads(new AzureApi(azure.fetch), new FakeToken());
    const none = new HostPullRequestConflicts([], false);

    const read: HostPullRequestConflicts[] = [
      await new AzureReads(new AzureApi(azure.fetch), new FakeToken(null)).readPullRequestConflictsAsync(reference, signal),
      await signedIn.readPullRequestConflictsAsync(new HostReference("git-github", "octocat", "hello-world", 12), signal),
      await signedIn.readPullRequestConflictsAsync(new HostReference("git-azure-devops", "contoso", repositoryId, 12), signal),
      await signedIn.readPullRequestConflictsAsync(new HostReference("git-azure-devops", "fabrikam", "site", 12), signal),
      await signedIn.readPullRequestConflictsAsync(reference, signal)
    ];

    assert.deepEqual([read, azure.urls()], [[none, none, none, none, none], [pullConflictsUrl]]);
  });

  it("signs out the token refused for the conflicts and fails as Unauthorized, fails an unreadable conflict as Unavailable, and drops a read for a changed token",
    async () => {
      const azure = new FakeAzure();
      azure.answer(new Response(null, { status: 401 }), FakeAzure.json({ value: [{ conflictId: 1 }] }));
      const token = new FakeToken();
      const reads = new AzureReads(new AzureApi(azure.fetch), token);

      const failures: (string | null)[] = [];
      for (let i = 0; i < 2; i++)
        failures.push(failureOf(await reads.readPullRequestConflictsAsync(reference, signal).then(() => null, (t: unknown) => t)));
      const release = azure.hold();
      const reading = reads.readPullRequestConflictsAsync(reference, signal);
      await azure.askedAsync(3);
      token.answer("token", AzureCredential.ofToken("other-token"));
      release(FakeAzure.json({ value: [{ conflictPath: "/a.ts" }] }));

      assert.deepEqual([failures, token.refused, await reading], [[FailureCode.Unauthorized, FailureCode.Unavailable], ["azure-token"],
        new HostPullRequestConflicts([], false)]);
    });

  it("reads a branch's newest pull request with its builds and its policies other than builds as checks, its votes as the decision and those above zero as approvals", async () => {
    const azure = new FakeAzure();
    azure.answer(FakeAzure.json({ value: [pull()] }),
      FakeAzure.json({ value: [evaluation("rejected", "Comment requirements", true), evaluation("running", "Build", true, "0609b952-1397-4640-95ec-e00a01b2c241")] }),
      FakeAzure.json({ value: [build("inProgress", null)] }));
    const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());

    const read: BranchPullRequest = await reads.readBranchPullRequestAsync(new BranchQuery("dev.azure.com", "fabrikam/web/_git/site", "feature/sign-in", null), signal);

    assert.deepEqual(read, new BranchPullRequest(item, [new HostCheck("site-ci", CheckState.Running, "https://dev.azure.com/fabrikam/web/_build/results?buildId=7"),
      new HostCheck("Comment requirements", CheckState.Failed, null)], ReviewDecision.Approved, 1));
    assert.deepEqual(azure.urls(), [listUrl, policiesUrl, buildsUrl]);
  });

  it("reads a branch's completed pull request as merged and its abandoned one as closed, each at its closing time", async () => {
    const azure = new FakeAzure();
    for (const status of ["completed", "abandoned"])
      azure.answer(FakeAzure.json({ value: [pull({ status, closedDate: "2027-01-16T10:00:00Z" })] }), FakeAzure.json({ value: [] }), FakeAzure.json({ value: [] }));
    const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());
    const query = new BranchQuery("dev.azure.com", "fabrikam/web/_git/site", "feature/sign-in", null);

    const read: BranchPullRequest[] = [await reads.readBranchPullRequestAsync(query, signal), await reads.readBranchPullRequestAsync(query, signal)];

    assert.deepEqual(read.map(t => [t.pullRequest?.state, t.pullRequest?.closedAt]), [[ReferenceState.Merged, Date.parse("2027-01-16T10:00:00Z")],
      [ReferenceState.Closed, Date.parse("2027-01-16T10:00:00Z")]]);
  });

  it("reads the pull request holding a commit with one pull request query, before the one whose merge made it, and that one's checks, votes and approvals", async () => {
    const azure = new FakeAzure();
    azure.answer(FakeAzure.json({ queries: [], results: [{ [commit]: [{ pullRequestId: 12 }] }, { [commit]: [{ pullRequestId: 15 }] }] }), FakeAzure.json(pull()),
      FakeAzure.json({ value: [evaluation("approved", "Work items", false)] }), FakeAzure.json({ value: [] }));
    const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());

    const read: BranchPullRequest = await reads.readCommitPullRequestAsync(commitQuery, signal);

    assert.deepEqual(read, new BranchPullRequest(item, [new HostCheck("Work items", CheckState.Succeeded, null)], ReviewDecision.Approved, 1));
    assert.deepEqual([azure.urls(), azure.requests[0]?.init.method, azure.requests[0]?.body], [[queryUrl, projectPullUrl(12), policiesUrl, buildsUrl], "POST",
      { queries: [{ type: "commit", items: [commit] }, { type: "lastMergeCommit", items: [commit] }] }]);
  });

  it("reads the pull request whose merge made a commit when none holds it", async () => {
    const azure = new FakeAzure();
    azure.answer(FakeAzure.json({ results: [{ [commit]: [] }, { [commit]: [{ pullRequestId: 15 }] }] }), new Response(null, { status: 404 }));
    const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());

    const read: BranchPullRequest = await reads.readCommitPullRequestAsync(commitQuery, signal);

    assert.deepEqual([read, azure.urls()], [new BranchPullRequest(null, []), [queryUrl, projectPullUrl(15)]]);
  });

  it("answers no pull request for a commit when signed out, for a remote that isn't Azure DevOps', when none brought it in or the repository is gone", async () => {
    const azure = new FakeAzure();
    azure.answer(FakeAzure.json({ results: [{}, {}] }), new Response(null, { status: 404 }));
    const none = new BranchPullRequest(null, []);

    const read: BranchPullRequest[] = [
      await new AzureReads(new AzureApi(azure.fetch), new FakeToken(null)).readCommitPullRequestAsync(commitQuery, signal),
      await new AzureReads(new AzureApi(azure.fetch), new FakeToken()).readCommitPullRequestAsync(new CommitQuery("github.com", "octocat/hello-world", commit), signal),
      await new AzureReads(new AzureApi(azure.fetch), new FakeToken("azure-token", "contoso")).readCommitPullRequestAsync(commitQuery, signal),
      await new AzureReads(new AzureApi(azure.fetch), new FakeToken()).readCommitPullRequestAsync(commitQuery, signal),
      await new AzureReads(new AzureApi(azure.fetch), new FakeToken()).readCommitPullRequestAsync(commitQuery, signal)
    ];

    assert.deepEqual([read, azure.urls()], [[none, none, none, none, none], [queryUrl, queryUrl]]);
  });

  it("signs out the token refused for a commit's pull request, fails an unreadable query answer as Unavailable, and drops the answer for a token that changed", async () => {
    const azure = new FakeAzure();
    azure.answer(new Response(null, { status: 401 }), FakeAzure.json({ results: [{ [commit]: [{ pullRequestId: "12" }] }] }));
    const token = new FakeToken();
    const reads = new AzureReads(new AzureApi(azure.fetch), token);

    const failures: (string | null)[] = [];
    for (let i = 0; i < 2; i++)
      failures.push(failureOf(await reads.readCommitPullRequestAsync(commitQuery, signal).then(() => null, (t: unknown) => t)));
    const release = azure.hold();
    const reading = reads.readCommitPullRequestAsync(commitQuery, signal);
    await azure.askedAsync(3);
    token.answer("token", AzureCredential.ofToken("other-token"));
    release(FakeAzure.json({ results: [{}, {}] }));

    assert.deepEqual([failures, token.refused, await reading], [[FailureCode.Unauthorized, FailureCode.Unavailable], ["azure-token"], new BranchPullRequest(null, [])]);
  });

  it("counts the people's comments in the threads made on the commit's iterations of the pull request that brought it in, opening its files there",
    async () => {
      const azure = new FakeAzure();
      azure.answer(pulledBy(), FakeAzure.json(pull()), iterated(), FakeAzure.json({ value: [
        threadOn(2, [...said(2), { id: 9, commentType: "system", content: "Policy changed" }]), threadOn(3, [...said(1), ...said(1, { isDeleted: true })]),
        threadOn(1, said(4)), { id: 5, comments: said(1) }, { id: 6, pullRequestThreadContext: null, comments: said(1) },
        { id: 7, pullRequestThreadContext: {}, comments: said(1) }, { id: 8, pullRequestThreadContext: { iterationContext: null }, comments: said(1) },
        { ...threadOn(2, said(3)), isDeleted: true }] }));
      const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());

      const read: HostCommitComments = await reads.readCommitCommentsAsync(commitQuery, signal);

      assert.deepEqual([read, azure.urls()], [new HostCommitComments(3, false, `${page}?_a=files&iteration=3`), [queryUrl, projectPullUrl(12), pullIterationsUrl,
        threadsUrl]]);
    });

  it("caps the count past 100 comments, and answers none with no comment on the commit, no pull request, or a pull request that's gone", async () => {
    const azure = new FakeAzure();
    azure.answer(pulledBy(), FakeAzure.json(pull()), iterated(), FakeAzure.json({ value: [threadOn(2, said(101))] }), pulledBy(), FakeAzure.json(pull()), iterated(),
      FakeAzure.json({ value: [threadOn(1, said(2))] }), FakeAzure.json({ results: [{}, {}] }), pulledBy(), FakeAzure.json(pull()), new Response(null, { status: 404 }),
      FakeAzure.json({ value: [] }));
    const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());

    const read: HostCommitComments[] = [];
    for (let i = 0; i < 4; i++)
      read.push(await reads.readCommitCommentsAsync(commitQuery, signal));

    assert.deepEqual(read.map(t => [t.count, t.isCapped, t.url]), [[100, true, `${page}?_a=files&iteration=3`], [0, false, null], [0, false, null], [0, false, null]]);
  });

  it("answers no comments without asking Azure DevOps when signed out or for another organization or host, and none for a token that changed", async () => {
    const azure = new FakeAzure();
    const token = new FakeToken();
    const reads = new AzureReads(new AzureApi(azure.fetch), token);
    const release = azure.hold();

    const read: HostCommitComments[] = [await new AzureReads(new AzureApi(azure.fetch), new FakeToken(null)).readCommitCommentsAsync(commitQuery, signal),
      await reads.readCommitCommentsAsync(new CommitQuery("github.com", "octocat/hello-world", commit), signal),
      await new AzureReads(new AzureApi(azure.fetch), new FakeToken("azure-token", "contoso")).readCommitCommentsAsync(commitQuery, signal)];
    const reading = reads.readCommitCommentsAsync(commitQuery, signal);
    await azure.askedAsync(1);
    token.answer("token", AzureCredential.ofToken("other-token"));
    release(FakeAzure.json({ results: [{}, {}] }));
    read.push(await reading);

    assert.deepEqual([read, azure.urls()], [Array.from({ length: 4 }, () => HostCommitComments.none()), [queryUrl]]);
  });

  it("signs out the token refused for a commit's comments, and fails an iteration it can't read as Unavailable", async () => {
    const azure = new FakeAzure();
    azure.answer(new Response(null, { status: 401 }), pulledBy(), FakeAzure.json(pull()), FakeAzure.json({ value: [{ id: 2 }] }), FakeAzure.json({ value: [] }));
    const token = new FakeToken();
    const reads = new AzureReads(new AzureApi(azure.fetch), token);

    const failures: (string | null)[] = [];
    for (let i = 0; i < 2; i++)
      failures.push(failureOf(await reads.readCommitCommentsAsync(commitQuery, signal).then(() => null, (t: unknown) => t)));

    assert.deepEqual([failures, token.refused], [[FailureCode.Unauthorized, FailureCode.Unavailable], ["azure-token"]]);
  });

  it("decides changes are asked for when any vote is below zero, approved when one is above and none below, and waiting otherwise", async () => {
    const azure = new FakeAzure();
    const query = new BranchQuery("dev.azure.com", "fabrikam/web/_git/site", "feature/sign-in", null);
    for (const votes of [[10, -5], [0, 0]]) {
      azure.answer(FakeAzure.json({ value: [pull({ reviewers: votes.map(t => ({ uniqueName: "octocat@fabrikam.com", vote: t })) })] }),
        FakeAzure.json({ value: [evaluation("queued", "Status", false), evaluation("approved", "Work items", false), evaluation("notApplicable", "Merge strategy", false)] }),
        FakeAzure.json({ value: [] }));
    }
    const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());

    const read: BranchPullRequest[] = [await reads.readBranchPullRequestAsync(query, signal), await reads.readBranchPullRequestAsync(query, signal)];

    assert.deepEqual(read.map(t => t.reviewDecision), [ReviewDecision.ChangesRequested, ReviewDecision.Waiting]);
    assert.deepEqual(read[0]?.checks.map(t => t.state), [CheckState.Queued, CheckState.Succeeded, CheckState.Neutral]);
  });

  it("answers no pull request when signed out, for a remote that isn't Azure DevOps', or when the branch has none or the repository is gone", async () => {
    const azure = new FakeAzure();
    azure.answer(FakeAzure.json({ value: [] }), new Response(null, { status: 404 }));
    const query = new BranchQuery("dev.azure.com", "fabrikam/web/_git/site", "feature/sign-in", null);
    const none = new BranchPullRequest(null, []);

    const read: BranchPullRequest[] = [
      await new AzureReads(new AzureApi(azure.fetch), new FakeToken(null)).readBranchPullRequestAsync(query, signal),
      await new AzureReads(new AzureApi(azure.fetch), new FakeToken()).readBranchPullRequestAsync(new BranchQuery("github.com", "octocat/hello-world", "main", null), signal),
      await new AzureReads(new AzureApi(azure.fetch), new FakeToken()).readBranchPullRequestAsync(query, signal),
      await new AzureReads(new AzureApi(azure.fetch), new FakeToken()).readBranchPullRequestAsync(query, signal)
    ];

    assert.deepEqual([read, azure.requests.length], [[none, none, none, none], 2]);
  });

  it("signs out the token Azure DevOps refuses and fails as Unauthorized, and fails an unreadable answer as Unavailable", async () => {
    const azure = new FakeAzure();
    azure.answer(new Response(null, { status: 401 }), FakeAzure.json(pull({ title: " " })), FakeAzure.json({ value: "none" }));
    const token = new FakeToken();
    const reads = new AzureReads(new AzureApi(azure.fetch), token);

    const failures: (string | null)[] = [
      failureOf(await reads.readReferenceAsync(reference, signal).then(() => null, (t: unknown) => t)),
      failureOf(await reads.readPullRequestAsync(reference, signal).then(() => null, (t: unknown) => t)),
      failureOf(await reads.readBranchPullRequestAsync(new BranchQuery("dev.azure.com", "fabrikam/web/_git/site", "main", null), signal)
        .then(() => null, (t: unknown) => t))
    ];

    assert.deepEqual([failures, token.refused], [[FailureCode.Unauthorized, FailureCode.Unavailable, FailureCode.Unavailable], ["azure-token"]]);
  });

  it("reads the active pull requests with each one's approving votes, its builds and its policies other than builds counted as checks, and its source and target branches", async () => {
    const azure = new FakeAzure();
    const draft = pull({ pullRequestId: 13, isDraft: true, title: "Try the new layout", reviewers: [{ uniqueName: "octocat@fabrikam.com", vote: -10 }],
      sourceRefName: "refs/heads/layout/grid", targetRefName: "refs/heads/feature/sign-in" });
    azure.answer(FakeAzure.json({ value: [pull(), draft] }),
      FakeAzure.json({ value: [evaluation("rejected", "Comment requirements", true), evaluation("running", "Build", true, "0609b952-1397-4640-95ec-e00a01b2c241")] }),
      FakeAzure.json({ value: [build("completed", "succeeded")] }), FakeAzure.json({ value: [] }), FakeAzure.json({ value: [] }));
    const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());

    const list: HostPullRequestList = await reads.readPullRequestsAsync(new RepositoryQuery("dev.azure.com", "fabrikam/web/_git/site"), signal);

    assert.deepEqual(list, new HostPullRequestList([new HostPullRequestRow(reference, "Add the sign-in page", page, false, 1, 1, 1, 0, "feature/sign-in", "main"),
      new HostPullRequestRow(new HostReference("git-azure-devops", "fabrikam", repositoryId, 13), "Try the new layout",
        "https://dev.azure.com/fabrikam/Web%20Site/_git/site/pullrequest/13", true, 0, 0, 0, 0, "layout/grid", "feature/sign-in")], false));
    assert.deepEqual(azure.urls().slice(0, 3), [
      "https://dev.azure.com/fabrikam/web/_apis/git/repositories/site/pullrequests?searchCriteria.status=active&$top=21&api-version=7.1", policiesUrl, buildsUrl]);
  });

  it("reads the active pull requests' heads and bases from the list read alone, without votes or checks, at most 100 and telling there are more", async () => {
    const azure = new FakeAzure();
    const draft = pull({ pullRequestId: 13, isDraft: true, title: "Try the new layout", sourceRefName: "refs/heads/layout/grid", targetRefName: "refs/heads/feature/sign-in" });
    const pullsOf = (count: number): Response => FakeAzure.json({ value: Array.from({ length: count }, (_t, index) => pull({ pullRequestId: index + 1 })) });
    azure.answer(FakeAzure.json({ value: [pull(), draft] }), pullsOf(101), pullsOf(100));
    const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());
    const query = new RepositoryQuery("dev.azure.com", "fabrikam/web/_git/site");

    const lists = [await reads.readPullRequestHeadsAsync(query, signal), await reads.readPullRequestHeadsAsync(query, signal),
      await reads.readPullRequestHeadsAsync(query, signal)];

    assert.deepEqual(lists[0], new HostPullRequestHeads([new HostPullRequestHead(reference, "Add the sign-in page", page, "feature/sign-in", "main"),
      new HostPullRequestHead(new HostReference("git-azure-devops", "fabrikam", repositoryId, 13), "Try the new layout",
        "https://dev.azure.com/fabrikam/Web%20Site/_git/site/pullrequest/13", "layout/grid", "feature/sign-in")], false));
    assert.deepEqual([lists[1]?.rows.length, lists[1]?.hasMore, lists[1]?.rows.at(-1)?.reference.number, lists[2]?.rows.length, lists[2]?.hasMore, azure.urls()],
      [100, true, 100, 100, false, Array.from({ length: 3 }, () =>
        "https://dev.azure.com/fabrikam/web/_apis/git/repositories/site/pullrequests?searchCriteria.status=active&$top=101&api-version=7.1")]);
  });

  it("answers signed out or none for the heads as for the list, signed out once the token changed, and none for a repository that is gone", async () => {
    const azure = new FakeAzure();
    const token = new FakeToken();
    const release = azure.hold();
    const reads = new AzureReads(new AzureApi(azure.fetch), token);
    const query = new RepositoryQuery("dev.azure.com", "fabrikam/web/_git/site");

    const reading = reads.readPullRequestHeadsAsync(query, signal);
    await azure.askedAsync(1);
    token.answer("token", AzureCredential.ofToken("other-token"));
    release(FakeAzure.json({ value: [pull()] }));
    const changed = await reading;
    azure.answer(new Response(null, { status: 404 }));
    const lists = [await new AzureReads(new AzureApi(azure.fetch), new FakeToken(null)).readPullRequestHeadsAsync(query, signal),
      await new AzureReads(new AzureApi(azure.fetch), new FakeToken()).readPullRequestHeadsAsync(new RepositoryQuery("github.com", "octocat/hello-world"), signal),
      await new AzureReads(new AzureApi(azure.fetch), new FakeToken()).readPullRequestHeadsAsync(new RepositoryQuery("dev.azure.com", "contoso/web/_git/site"), signal),
      changed, await new AzureReads(new AzureApi(azure.fetch), new FakeToken()).readPullRequestHeadsAsync(new RepositoryQuery("dev.azure.com", "fabrikam/web/_git/gone"), signal)];

    assert.deepEqual([lists, azure.requests.length], [[HostPullRequestHeads.signedOut(), new HostPullRequestHeads([], false), new HostPullRequestHeads([], false),
      HostPullRequestHeads.signedOut(), new HostPullRequestHeads([], false)], 2]);
  });

  it("signs out the token Azure DevOps refuses for the heads and fails as Unauthorized, and fails a head it can't read as Unavailable", async () => {
    const azure = new FakeAzure();
    azure.answer(new Response(null, { status: 401 }), FakeAzure.json({ value: [pull({ title: " " })] }), FakeAzure.json({ value: [pull({ sourceRefName: "refs/heads/" })] }));
    const token = new FakeToken();
    const reads = new AzureReads(new AzureApi(azure.fetch), token);
    const query = new RepositoryQuery("dev.azure.com", "fabrikam/web/_git/site");

    const failures = [failureOf(await reads.readPullRequestHeadsAsync(query, signal).then(() => null, (t: unknown) => t)),
      failureOf(await reads.readPullRequestHeadsAsync(query, signal).then(() => null, (t: unknown) => t)),
      failureOf(await reads.readPullRequestHeadsAsync(query, signal).then(() => null, (t: unknown) => t))];

    assert.deepEqual([failures, token.refused], [[FailureCode.Unauthorized, FailureCode.Unavailable, FailureCode.Unavailable], ["azure-token"]]);
  });

  it("reads 20 pull requests and tells there are more past them, and none for a repository that is gone", async () => {
    const azure = new FakeAzure();
    azure.answer(FakeAzure.json({ value: Array.from({ length: 21 }, (_t, index) => pull({ pullRequestId: index + 1 })) }),
      ...Array.from({ length: 40 }, () => FakeAzure.json({ value: [] })), new Response(null, { status: 404 }));
    const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());
    const query = new RepositoryQuery("dev.azure.com", "fabrikam/web/_git/site");

    const lists = [await reads.readPullRequestsAsync(query, signal), await reads.readPullRequestsAsync(new RepositoryQuery("dev.azure.com", "fabrikam/web/_git/gone"), signal)];

    assert.deepEqual(lists.map(t => [t.rows.length, t.rows.at(-1)?.reference.number, t.hasMore, t.isSignedIn]), [[20, 20, true, true], [0, undefined, false, true]]);
    assert.deepEqual(azure.requests.length, 42);
  });

  it("answers signed out when signed out or once the token changed, and none for another host or organization, without asking Azure DevOps", async () => {
    const azure = new FakeAzure();
    const token = new FakeToken();
    const release = azure.hold();
    const reads = new AzureReads(new AzureApi(azure.fetch), token);

    const reading = reads.readPullRequestsAsync(new RepositoryQuery("dev.azure.com", "fabrikam/web/_git/site"), signal);
    await azure.askedAsync(1);
    token.answer("token", AzureCredential.ofToken("other-token"));
    release(FakeAzure.json({ value: [] }));
    const lists = [await new AzureReads(new AzureApi(azure.fetch), new FakeToken(null)).readPullRequestsAsync(new RepositoryQuery("dev.azure.com", "fabrikam/web/_git/site"), signal),
      await new AzureReads(new AzureApi(azure.fetch), new FakeToken()).readPullRequestsAsync(new RepositoryQuery("github.com", "octocat/hello-world"), signal),
      await new AzureReads(new AzureApi(azure.fetch), new FakeToken()).readPullRequestsAsync(new RepositoryQuery("dev.azure.com", "contoso/web/_git/site"), signal),
      await reading];

    assert.deepEqual([lists, azure.requests.length], [[HostPullRequestList.signedOut(), new HostPullRequestList([], false), new HostPullRequestList([], false),
      HostPullRequestList.signedOut()], 1]);
  });

  it("signs out the token Azure DevOps refuses for the pull requests and fails as Unauthorized, and fails a row it can't read as Unavailable", async () => {
    const azure = new FakeAzure();
    azure.answer(new Response(null, { status: 401 }), FakeAzure.json({ value: [pull({ title: " " })] }), FakeAzure.json({ value: [] }), FakeAzure.json({ value: [] }));
    const token = new FakeToken();
    const reads = new AzureReads(new AzureApi(azure.fetch), token);
    const query = new RepositoryQuery("dev.azure.com", "fabrikam/web/_git/site");

    const failures = [failureOf(await reads.readPullRequestsAsync(query, signal).then(() => null, (t: unknown) => t)),
      failureOf(await reads.readPullRequestsAsync(query, signal).then(() => null, (t: unknown) => t))];

    assert.deepEqual([failures, token.refused], [[FailureCode.Unauthorized, FailureCode.Unavailable], ["azure-token"]]);
  });

  it("reads the person's id once, then the active pull requests that list them as a reviewer who hasn't voted, the newest first", async () => {
    const azure = new FakeAzure();
    azure.answer(connection(), FakeAzure.json({ value: [asking(0), asking(10, { pullRequestId: 13 }), asking(0, { pullRequestId: 14, isDraft: true,
      title: "Try the new layout", creationDate: "2027-01-16T08:00:00Z" }), pull({ pullRequestId: 15 })] }), FakeAzure.json({ value: [] }));
    const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());
    const query = new RepositoryQuery("dev.azure.com", "fabrikam/web/_git/site");

    const lists = [await reads.readReviewRequestsAsync(query, signal), await reads.readReviewRequestsAsync(query, signal)];

    assert.deepEqual(lists, [new HostReviewRequestList([new HostReviewRequest(new HostReference("git-azure-devops", "fabrikam", repositoryId, 14), "Try the new layout",
      "https://dev.azure.com/fabrikam/Web%20Site/_git/site/pullrequest/14", true, Date.parse("2027-01-16T08:00:00Z")),
    new HostReviewRequest(reference, "Add the sign-in page", page, false, Date.parse("2027-01-15T09:30:00Z"))], false), new HostReviewRequestList([], false)]);
    assert.deepEqual(azure.urls(), [connectionUrl, reviewRequestsUrl, reviewRequestsUrl]);
  });

  it("reads 100 review requests and tells there are more past them, none for a repository that is gone, and the id again for a new token", async () => {
    const azure = new FakeAzure();
    azure.answer(connection(), FakeAzure.json({ value: Array.from({ length: 101 }, (_t, index) => asking(0, { pullRequestId: index + 1 })) }),
      new Response(null, { status: 404 }), connection(), FakeAzure.json({ value: [] }));
    const token = new FakeToken();
    const reads = new AzureReads(new AzureApi(azure.fetch), token);
    const query = new RepositoryQuery("dev.azure.com", "fabrikam/web/_git/site");

    const lists = [await reads.readReviewRequestsAsync(query, signal), await reads.readReviewRequestsAsync(new RepositoryQuery("dev.azure.com", "fabrikam/web/_git/gone"),
      signal)];
    token.answer("token", AzureCredential.ofToken("other-token"));
    lists.push(await reads.readReviewRequestsAsync(query, signal));

    assert.deepEqual(lists.map(t => [t.rows.length, t.hasMore, t.isSignedIn]), [[100, true, true], [0, false, true], [0, false, true]]);
    assert.deepEqual(azure.urls().filter(t => t === connectionUrl).length, 2);
  });

  it("answers signed out when signed out or once the token changed, and none for another host or organization, without asking Azure DevOps", async () => {
    const azure = new FakeAzure();
    const token = new FakeToken();
    const release = azure.hold();
    const reads = new AzureReads(new AzureApi(azure.fetch), token);

    const reading = reads.readReviewRequestsAsync(new RepositoryQuery("dev.azure.com", "fabrikam/web/_git/site"), signal);
    await azure.askedAsync(1);
    token.answer("token", AzureCredential.ofToken("other-token"));
    release(connection());
    azure.answer(FakeAzure.json({ value: [asking(0)] }));
    const lists = [await new AzureReads(new AzureApi(azure.fetch), new FakeToken(null)).readReviewRequestsAsync(new RepositoryQuery("dev.azure.com",
      "fabrikam/web/_git/site"), signal),
    await new AzureReads(new AzureApi(azure.fetch), new FakeToken()).readReviewRequestsAsync(new RepositoryQuery("github.com", "octocat/hello-world"), signal),
    await new AzureReads(new AzureApi(azure.fetch), new FakeToken()).readReviewRequestsAsync(new RepositoryQuery("dev.azure.com", "contoso/web/_git/site"), signal),
    await reading];

    assert.deepEqual([lists, azure.requests.length], [[HostReviewRequestList.signedOut(), new HostReviewRequestList([], false), new HostReviewRequestList([], false),
      HostReviewRequestList.signedOut()], 2]);
  });

  it("signs out the token Azure DevOps refuses for the review requests, and fails as Unavailable when it can't read the person's id", async () => {
    const azure = new FakeAzure();
    azure.answer(new Response(null, { status: 401 }), FakeAzure.json({ authenticatedUser: { id: " " } }), new Response(null, { status: 404 }));
    const token = new FakeToken();
    const reads = new AzureReads(new AzureApi(azure.fetch), token);
    const query = new RepositoryQuery("dev.azure.com", "fabrikam/web/_git/site");

    const failures = [failureOf(await reads.readReviewRequestsAsync(query, signal).then(() => null, (t: unknown) => t)),
      failureOf(await reads.readReviewRequestsAsync(query, signal).then(() => null, (t: unknown) => t)),
      failureOf(await reads.readReviewRequestsAsync(query, signal).then(() => null, (t: unknown) => t))];

    assert.deepEqual([failures, token.refused], [[FailureCode.Unauthorized, FailureCode.Unavailable, FailureCode.Unavailable], ["azure-token"]]);
  });

  it("reads the merge types every merge-type policy allows, in Azure DevOps's order, a policy with no allow settings by its legacy useSquashMerge, or all four without one or when the policies can't be shown", async () => {
    const azure = new FakeAzure();
    const limit = (settings: Readonly<Record<string, boolean>>): Record<string, unknown> => ({ status: "approved",
      configuration: { isBlocking: true, type: { id: "fa4e907d-c16b-4a4c-9dfa-4916e5d171ab", displayName: "Limit merge types" }, settings } });
    azure.answer(FakeAzure.json(pull()), FakeAzure.json({ value: [limit({ allowRebaseMerge: true, allowSquash: true, allowRebase: false }),
      limit({ allowSquash: true, allowRebaseMerge: true, allowNoFastForward: true }), evaluation("approved", "Build", true, "0609b952-1397-4640-95ec-e00a01b2c241")] }),
    FakeAzure.json(pull()), FakeAzure.json({ value: [limit({ useSquashMerge: true })] }),
    FakeAzure.json(pull()), FakeAzure.json({ value: [limit({}), limit({ allowNoFastForward: true, allowSquash: true })] }),
    FakeAzure.json(pull()), FakeAzure.json({ value: [limit({ useSquashMerge: false })] }),
    FakeAzure.json(pull()), FakeAzure.json({ value: [limit({ useSquashMerge: false, allowSquash: true })] }),
    FakeAzure.json(pull()), FakeAzure.json({ value: [evaluation("approved", "Minimum number of reviewers", true)] }),
    FakeAzure.json(pull()), new Response(null, { status: 404 }), new Response(null, { status: 404 }), FakeAzure.json(pull({ repository: {} })));
    const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());

    const types: unknown[] = [];
    for (let attempt = 0; attempt < 8; attempt++)
      types.push(await reads.readMergeTypesAsync(reference, signal));
    const failure: unknown = await reads.readMergeTypesAsync(reference, signal).then(() => null, (t: unknown) => t);

    const all = ["noFastForward", "squash", "rebase", "rebaseMerge"];
    assert.deepEqual([types, failure instanceof MethodFailureException ? failure.failure.code : failure], [[["squash", "rebaseMerge"], ["squash"], ["noFastForward"], ["noFastForward"], ["squash"], all, all, null],
      FailureCode.Unavailable]);
    assert.deepEqual(azure.urls(), [...Array(7).fill([pullUrl, policiesUrl]).flat(), pullUrl, pullUrl]);
  });

  it("reads no merge types when signed out, for another host or organization, or once the token changed while it read", async () => {
    const azure = new FakeAzure();
    const token = new FakeToken();
    const release = azure.hold();
    azure.answer(FakeAzure.json({ value: [] }));
    const reads = new AzureReads(new AzureApi(azure.fetch), token);

    const reading = reads.readMergeTypesAsync(reference, signal);
    await azure.askedAsync(1);
    token.answer("token", AzureCredential.ofToken("other-token"));
    release(FakeAzure.json(pull()));
    const read = [await reading, await new AzureReads(new AzureApi(azure.fetch), new FakeToken(null)).readMergeTypesAsync(reference, signal),
      await reads.readMergeTypesAsync(new HostReference("git-github", "octocat", "hello-world", 12), signal),
      await new AzureReads(new AzureApi(azure.fetch), new FakeToken("azure-token", "contoso")).readMergeTypesAsync(reference, signal)];

    assert.deepEqual([read, azure.requests.length], [[null, null, null, null], 2]);
  });

  it("drops an answer for a token that was signed out or changed while it was read", async () => {
    const azure = new FakeAzure();
    const token = new FakeToken();
    const release = azure.hold();
    const releaseFull = azure.hold();
    const releaseBranch = azure.hold();
    const reads = new AzureReads(new AzureApi(azure.fetch), token);

    const reading = reads.readReferenceAsync(reference, signal);
    const readingFull = reads.readPullRequestAsync(reference, signal);
    const readingBranch = reads.readBranchPullRequestAsync(new BranchQuery("dev.azure.com", "fabrikam/web/_git/site", "main", null), signal);
    await azure.askedAsync(3);
    token.answer("token", AzureCredential.ofToken("other-token"));
    release(FakeAzure.json(pull()));
    releaseFull(new Response(null, { status: 404 }));
    releaseBranch(FakeAzure.json({ value: [] }));

    assert.deepEqual([await reading, await readingFull, await readingBranch], [null, null, new BranchPullRequest(null, [])]);
  });

  it("reads a work item with its type's name, colour and icon, its state's category, its page, assignee, iteration, area and parent", async () => {
    const azure = new FakeAzure();
    azure.answer(FakeAzure.json(workItem()), FakeAzure.json(workItemType()));
    const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());

    const read: HostWorkItem | null = await reads.readWorkItemAsync(workItemQuery, signal);

    assert.deepEqual([read, azure.urls()], [storyItem, [workItemUrl, typeUrl]]);
  });

  it("reads a work item with no assignee, iteration, area or parent, and one whose state its type doesn't list as proposed", async () => {
    const azure = new FakeAzure();
    azure.answer(FakeAzure.json(workItem({ "System.AssignedTo": undefined, "System.IterationPath": undefined, "System.AreaPath": undefined,
      "System.Parent": undefined, "System.State": "Triaged" })), FakeAzure.json(workItemType()));
    const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());

    const read: HostWorkItem | null = await reads.readWorkItemAsync(workItemQuery, signal);

    assert.deepEqual(read, new HostWorkItem("git-azure-devops", "fabrikam", "Web Site", 42, story, "Sign in with a token", "Triaged",
      WorkItemCategory.Proposed, "https://dev.azure.com/fabrikam/Web%20Site/_workitems/edit/42", null, null, null, null));
  });

  it("reads each type of a project once for an account, in any letter case, and again for another account", async () => {
    const azure = new FakeAzure();
    azure.answer(FakeAzure.json(workItem()), FakeAzure.json(workItemType()), FakeAzure.json(workItem({ "System.WorkItemType": "user story" })),
      FakeAzure.json(workItem()), FakeAzure.json(workItemType()));
    const token = new FakeToken();
    const reads = new AzureReads(new AzureApi(azure.fetch), token);

    const first = await reads.readWorkItemAsync(workItemQuery, signal);
    const again = await reads.readWorkItemAsync(workItemQuery, signal);
    token.answer("token", AzureCredential.ofToken("other-token"));
    const other = await reads.readWorkItemAsync(workItemQuery, signal);

    assert.deepEqual([first, again, other], [storyItem, storyItem, storyItem]);
    assert.deepEqual(azure.urls(), [workItemUrl, typeUrl, workItemUrl, workItemUrl, typeUrl]);
  });

  it("answers null signed out, for another host's or organization's query and for a work item Azure DevOps doesn't show", async () => {
    const azure = new FakeAzure();
    azure.answer(new Response(null, { status: 404 }));
    const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());

    const read: (HostWorkItem | null)[] = [
      await new AzureReads(new AzureApi(azure.fetch), new FakeToken(null)).readWorkItemAsync(workItemQuery, signal),
      await reads.readWorkItemAsync(new WorkItemQuery("git-github", "fabrikam", 42), signal),
      await reads.readWorkItemAsync(new WorkItemQuery("git-azure-devops", "fab_rikam", 42), signal),
      await reads.readWorkItemAsync(workItemQuery, signal)
    ];

    assert.deepEqual([read, azure.urls()], [[null, null, null, null], [workItemUrl]]);
  });

  it("signs out the token refused for a work item, and fails as Unavailable on a type it can't find or an unreadable item or type", async () => {
    const azure = new FakeAzure();
    azure.answer(new Response(null, { status: 401 }), FakeAzure.json(workItem()), new Response(null, { status: 404 }),
      FakeAzure.json(workItem({ "System.Title": " " })), FakeAzure.json(workItemType()), FakeAzure.json({ id: 42 }),
      FakeAzure.json(workItem({ "System.WorkItemType": "Bug" })), FakeAzure.json({ ...workItemType("Bug"), color: "blue" }));
    const token = new FakeToken();
    const reads = new AzureReads(new AzureApi(azure.fetch), token);

    const failures: (string | null)[] = [];
    for (let attempt = 0; attempt < 5; attempt++)
      failures.push(failureOf(await reads.readWorkItemAsync(workItemQuery, signal).then(() => null, (t: unknown) => t)));

    assert.deepEqual([failures, token.refused, azure.requests.length], [[FailureCode.Unauthorized, FailureCode.Unavailable, FailureCode.Unavailable,
      FailureCode.Unavailable, FailureCode.Unavailable], ["azure-token"], 8]);
  });

  it("drops a work item read for a token that changed while it was read, and keeps no type read for the old token", async () => {
    const azure = new FakeAzure();
    azure.answer(FakeAzure.json(workItem()));
    const releaseType = azure.hold();
    azure.answer(FakeAzure.json(workItem()), FakeAzure.json(workItemType()), FakeAzure.json(workItem()));
    const token = new FakeToken();
    const reads = new AzureReads(new AzureApi(azure.fetch), token);

    const reading = reads.readWorkItemAsync(workItemQuery, signal);
    await azure.askedAsync(2);
    token.answer("token", AzureCredential.ofToken("other-token"));
    const other = await reads.readWorkItemAsync(workItemQuery, signal);
    releaseType(FakeAzure.json(workItemType()));
    const dropped = await reading;
    const again = await reads.readWorkItemAsync(workItemQuery, signal);

    assert.deepEqual([dropped, other, again], [null, storyItem, storyItem]);
    assert.deepEqual(azure.urls(), [workItemUrl, typeUrl, workItemUrl, typeUrl, workItemUrl]);
  });

  it("asks nothing for another organization than the token's, so its refusal never signs the token out, and reads its own in any letter case", async () => {
    const azure = new FakeAzure();
    azure.answer(FakeAzure.json(pull()));
    const token = new FakeToken("azure-token", "Fabrikam");
    const reads = new AzureReads(new AzureApi(azure.fetch), token);
    const other: HostReference = new HostReference("git-azure-devops", "contoso", repositoryId, 12);

    const read = [await reads.readReferenceAsync(other, signal), await reads.readPullRequestAsync(other, signal),
      await reads.readBranchPullRequestAsync(new BranchQuery("dev.azure.com", "contoso/web/_git/site", "feature/sign-in", null), signal),
      await reads.readWorkItemAsync(new WorkItemQuery("git-azure-devops", "contoso", 42), signal),
      await reads.readReferenceAsync(reference, signal)];

    assert.deepEqual([read, azure.urls(), token.refused], [[null, null, new BranchPullRequest(null, []), null, item], [pullUrl], []]);
  });
});

const wiqlUrl: string = "https://dev.azure.com/fabrikam/Web%20Site/_apis/wit/wiql?$top=200&api-version=7.1";
const batchUrl: string = "https://dev.azure.com/fabrikam/_apis/wit/workitemsbatch?api-version=7.1";
const typesUrl: string = "https://dev.azure.com/fabrikam/Web%20Site/_apis/wit/workitemtypes?api-version=7.1";
const mine: WorkItemsQuery = new WorkItemsQuery("git-azure-devops", "fabrikam", "Web Site", WorkItemScope.Mine, []);
const childUrl = (id: number | string): string => `https://dev.azure.com/fabrikam/_apis/wit/workItems/${id}`;
const commitLink: string = `vstfs:///Git/Commit/${projectId}%2F${repositoryId}%2F${commit}`;

function batched(id: number, fields: Readonly<Record<string, unknown>> = {}, relations?: readonly Record<string, unknown>[]): Record<string, unknown> {
  return { ...workItem(fields), id, ...relations === undefined ? {} : { relations } };
}

function relation(rel: string, url: string): Record<string, unknown> {
  return { rel, url, attributes: { name: rel === "ArtifactLink" ? "Branch" : "Child" } };
}

function itemOf(id: number, title: string, parent: number | null): HostWorkItem {
  return new HostWorkItem("git-azure-devops", "fabrikam", "Web Site", id, story, title, "Active", WorkItemCategory.InProgress,
    `https://dev.azure.com/fabrikam/Web%20Site/_workitems/edit/${id}`, new HostPerson("monalisa@fabrikam.com", null, null), "Web Site\\Sprint 3",
    "Web Site\\Accounts", parent);
}

function bare(item: HostWorkItem): HostWorkItemDetail {
  return new HostWorkItemDetail(item, null, null, null, null, null, [], [], 0, []);
}

const types = (): Response => FakeAzure.json({ count: 2, value: [workItemType(), { ...workItemType("Bug"), states: [
  { name: "New", category: "Proposed" }, { name: "Closed", category: "Completed" }, { name: "Removed", category: "Removed" }] }] });
const found = (...items: readonly unknown[]): Response => FakeAzure.json({ count: items.length, value: items });
const listed = (...ids: readonly number[]): Response => FakeAzure.json({ queryType: "flat", workItems: ids.map(t => ({ id: t, url: childUrl(t) })) });
describe("AzureReads, work items", () => {
  it("reads the person's work items that aren't closed with their ancestors, parents first, each with its plan, criteria and links", async () => {
    const azure = new FakeAzure();
    const linked: readonly Record<string, unknown>[] = [relation("System.LinkTypes.Hierarchy-Forward", childUrl(43)),
      relation("System.LinkTypes.Hierarchy-Forward", childUrl(43)), relation("System.LinkTypes.Hierarchy-Reverse", childUrl(40)),
      relation("ArtifactLink", `vstfs:///Git/PullRequestId/${projectId}%2F${repositoryId.toUpperCase()}%2F482`),
      relation("ArtifactLink", `vstfs:///Git/Ref/${projectId}%2F${repositoryId}%2FGBusers%2Fana%2F42-sign-in`),
      relation("ArtifactLink", `vstfs:///Git/Ref/${projectId}%2F${repositoryId}%2FGTv1.0`), relation("ArtifactLink", commitLink),
      relation("ArtifactLink", commitLink), relation("ArtifactLink", "vstfs:///Build/Build/7"), relation("Hyperlink", "https://example.com/42")];
    azure.answer(types(), listed(43, 42), found(
      batched(43, { "System.Title": "Export the note", "System.Parent": 42, "Microsoft.VSTS.Scheduling.Effort": 3,
        "Microsoft.VSTS.Scheduling.RemainingWork": 4, "Microsoft.VSTS.Scheduling.CompletedWork": 2.5, "Microsoft.VSTS.Common.BacklogPriority": 20 }),
      batched(42, { "Microsoft.VSTS.Scheduling.StoryPoints": 5, "Microsoft.VSTS.Scheduling.Size": 8, "Microsoft.VSTS.Common.StackRank": 1000.5,
        "Microsoft.VSTS.Common.AcceptanceCriteria": "<div>Readers see a due date &amp; a note.</div><div><br></div><ul><li>48 h</li><li>2&nbsp;h</li></ul>" },
      linked)), found(batched(40, { "System.Title": "Export all notes", "System.Parent": undefined,
      "Microsoft.VSTS.Common.AcceptanceCriteria": "<p> </p>" }, [])), FakeAzure.json(workItemType()));
    const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());

    const read: readonly HostWorkItemDetail[] = await reads.readWorkItemsAsync(mine, signal).then(t => t.items);

    assert.deepEqual(read, [bare(itemOf(40, "Export all notes", null)),
      new HostWorkItemDetail(storyItem, 5, null, null, 1000.5, "Readers see a due date & a note.\n\n48 h\n2 h", [43],
        [new HostReference("git-azure-devops", "fabrikam", repositoryId, 752)], 2, ["users/kim/42-sign-in"]),
      new HostWorkItemDetail(itemOf(43, "Export the note", 42), 3, 4, 2.5, 20, null, [], [], 0, [])]);
    assert.deepEqual(azure.urls(), [typesUrl, wiqlUrl, batchUrl, batchUrl, typeUrl]);
    assert.deepEqual([azure.requests[1]?.init.method, azure.requests[1]?.header("Content-Type"), azure.requests[1]?.body, azure.requests[2]?.body,
      azure.requests[3]?.body], ["POST", "application/json", { query: "SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project AND "
      + "[System.AssignedTo] = @Me AND [System.State] NOT IN ('Closed', 'Removed') ORDER BY [System.ChangedDate] DESC" },
    { ids: [43, 42], $expand: "Relations", errorPolicy: "Omit" }, { ids: [40], $expand: "Relations", errorPolicy: "Omit" }]);
  });

  it("reads work items by their ids in batches of 200 without a query, and answers none for ids Azure DevOps doesn't show", async () => {
    const azure = new FakeAzure();
    const ids: readonly number[] = Array.from({ length: 201 }, (_, index) => index + 1);
    azure.answer(found(), new Response(null, { status: 404 }));
    const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());

    const read = await reads.readWorkItemsAsync(new WorkItemsQuery("git-azure-devops", "fabrikam", "Web Site", WorkItemScope.Ids, ids), signal);

    assert.deepEqual([read, azure.urls(), azure.requests.map(t => t.body)], [new HostWorkItemList([], false), [batchUrl, batchUrl], [{ ids: ids.slice(0, 200),
      $expand: "Relations", errorPolicy: "Omit" }, { ids: [201], $expand: "Relations", errorPolicy: "Omit" }]]);
  });

  it("says the search stopped at its limit when the query answers its 200 work items, and not when it answers fewer", async () => {
    const azure = new FakeAzure();
    azure.answer(types(), listed(...Array.from({ length: 200 }, (_, index) => index + 1)), found(), types(), listed(...Array.from({ length: 199 }, (_, index) => index + 1)),
      found());
    const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());

    const read: readonly HostWorkItemList[] = [await reads.readWorkItemsAsync(mine, signal), await reads.readWorkItemsAsync(mine, signal)];

    assert.deepEqual(read, [new HostWorkItemList([], true), new HostWorkItemList([], false)]);
  });

  it("asks for every state of the person's work items when Azure DevOps doesn't show the project's types", async () => {
    const azure = new FakeAzure();
    azure.answer(new Response(null, { status: 404 }), listed());
    const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());

    const read: HostWorkItemList = await reads.readWorkItemsAsync(mine, signal);

    assert.deepEqual([read, azure.urls(), azure.requests[1]?.body], [new HostWorkItemList([], false), [typesUrl, wiqlUrl],
      { query: "SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.AssignedTo] = @Me ORDER BY [System.ChangedDate] DESC" }]);
  });

  it("answers no work items signed out, for another host's or organization's query, a query Azure DevOps doesn't show, or none found", async () => {
    const azure = new FakeAzure();
    azure.answer(types(), new Response(null, { status: 404 }), types(), listed());
    const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());

    const read: readonly (readonly HostWorkItemDetail[])[] = [
      await new AzureReads(new AzureApi(azure.fetch), new FakeToken(null)).readWorkItemsAsync(mine, signal).then(t => t.items),
      await reads.readWorkItemsAsync(new WorkItemsQuery("git-github", "fabrikam", "Web Site", WorkItemScope.Mine, []), signal).then(t => t.items),
      await reads.readWorkItemsAsync(new WorkItemsQuery("git-azure-devops", "fab_rikam", "Web Site", WorkItemScope.Mine, []), signal).then(t => t.items),
      await reads.readWorkItemsAsync(new WorkItemsQuery("git-azure-devops", "contoso", "Web Site", WorkItemScope.Mine, []), signal).then(t => t.items),
      await reads.readWorkItemsAsync(mine, signal).then(t => t.items), await reads.readWorkItemsAsync(mine, signal).then(t => t.items)
    ];

    assert.deepEqual([read, azure.urls()], [[[], [], [], [], [], []], [typesUrl, wiqlUrl, typesUrl, wiqlUrl]]);
  });

  it("signs out the token refused for work items, and fails as Unavailable on an answer it can't read", async () => {
    const azure = new FakeAzure();
    const lone: Readonly<Record<string, unknown>> = { "System.Parent": undefined };
    azure.answer(new Response(null, { status: 401 }),
      FakeAzure.json({ value: [{ ...workItemType(), states: [{ name: "Gone", category: "Gone" }] }] }),
      types(), FakeAzure.json({ workItems: [{ id: "42" }] }),
      types(), listed(42), FakeAzure.json({ value: "42" }),
      types(), listed(42), found({ fields: {} }),
      types(), listed(42), found({ ...batched(42), fields: { "System.TeamProject": " " } }),
      types(), listed(42), found({ ...batched(42), fields: { "System.TeamProject": "Web Site" } }),
      types(), listed(42), found(batched(42, lone, [relation("System.LinkTypes.Hierarchy-Forward", childUrl("4x"))])), FakeAzure.json(workItemType()),
      types(), listed(42), found(batched(42, { ...lone, "Microsoft.VSTS.Scheduling.StoryPoints": -1 })));
    const token = new FakeToken();
    const reads = new AzureReads(new AzureApi(azure.fetch), token);

    const failures: (string | null)[] = [];
    for (let i = 0; i < 9; i++)
      failures.push(failureOf(await reads.readWorkItemsAsync(mine, signal).then(t => t.items).then(() => null, (t: unknown) => t)));

    assert.deepEqual([failures, token.refused], [[FailureCode.Unauthorized, FailureCode.Unavailable, FailureCode.Unavailable, FailureCode.Unavailable,
      FailureCode.Unavailable, FailureCode.Unavailable, FailureCode.Unavailable, FailureCode.Unavailable, FailureCode.Unavailable], ["azure-token"]]);
  });

  it("drops work items read for a token that changed while they were read", async () => {
    const azure = new FakeAzure();
    const release = azure.hold();
    azure.answer(listed(42), found(batched(42, { "System.Parent": undefined }, [])), FakeAzure.json(workItemType()));
    const token = new FakeToken();
    const reads = new AzureReads(new AzureApi(azure.fetch), token);

    const reading = reads.readWorkItemsAsync(mine, signal).then(t => t.items);
    await azure.askedAsync(1);
    token.answer("token", AzureCredential.ofToken("other-token"));
    release(types());

    assert.deepEqual(await reading, []);
  });

  it("fails a work items query or batch Azure DevOps forbids as a refusal, keeping the sign-in", async () => {
    const forbidden = (): Response => FakeAzure.json({ message: "Access denied." }, 403);
    const queried = new FakeAzure();
    queried.answer(types(), forbidden());
    const batched = new FakeAzure();
    batched.answer(types(), listed(42), forbidden());
    const token = new FakeToken();

    const failures: unknown[] = [];
    for (const azure of [queried, batched])
      failures.push(await new AzureReads(new AzureApi(azure.fetch), token).readWorkItemsAsync(mine, signal).then(t => t.items).then(() => null,
        (t: unknown) => t instanceof MethodFailureException ? [t.failure.code, t.failure.message] : t));

    const refused = [FailureCode.Unavailable, "Azure DevOps refused the request (403)."];
    assert.deepEqual([failures, token.refused, queried.urls(), batched.urls()], [[refused, refused], [], [typesUrl, wiqlUrl], [typesUrl, wiqlUrl, batchUrl]]);
  });
});

const peopleQuery: PeopleQuery = new PeopleQuery(reference, "mona");
const subjectQueryUrl: string = "https://vssps.dev.azure.com/fabrikam/_apis/graph/subjectquery?api-version=7.1-preview.1";
const subject = (index: number, name: string = `Mona ${index}`): Record<string, unknown> =>
  ({ subjectKind: "user", descriptor: `aad.${index}`, displayName: name, principalName: `mona${index}@fabrikam.com`, mailAddress: null });

describe("AzureReads, people", () => {
  it("finds up to 10 people and groups of the organization through Graph, each with its descriptor, name, login and whether it's a group", async () => {
    const azure = new FakeAzure();
    azure.answer(FakeAzure.json({ value: [{ subjectKind: "Group", descriptor: "vssgp.R3JvdXA", displayName: "Web Team",
      principalName: "[Web Site]\\Web Team" },
      ...Array.from({ length: 11 }, (_, i) => subject(i))] }));
    const reads = new AzureReads(new AzureApi(azure.fetch), new FakeToken());

    const found: readonly FoundPerson[] = await reads.searchPeopleAsync(peopleQuery, signal);

    assert.deepEqual(found, [new FoundPerson("vssgp.R3JvdXA", "Web Team", "[Web Site]\\Web Team", true),
      ...Array.from({ length: 9 }, (_, i) => new FoundPerson(`aad.${i}`, `Mona ${i}`, `mona${i}@fabrikam.com`, false))]);
    assert.deepEqual([azure.urls(), azure.requests[0]?.init.method, azure.requests[0]?.body], [[subjectQueryUrl], "POST",
      { query: "mona", subjectKind: ["User", "Group"] }]);
  });

  it("finds no one, asking nothing, signed out or for another organization than the token's, and no one where Graph shows none", async () => {
    const azure = new FakeAzure();
    azure.answer(new Response(null, { status: 404 }));

    const found = [await new AzureReads(new AzureApi(azure.fetch), new FakeToken(null)).searchPeopleAsync(peopleQuery, signal),
      await new AzureReads(new AzureApi(azure.fetch), new FakeToken("azure-token", "contoso")).searchPeopleAsync(peopleQuery, signal),
      await new AzureReads(new AzureApi(azure.fetch), new FakeToken()).searchPeopleAsync(peopleQuery, signal)];

    assert.deepEqual([found, azure.urls()], [[[], [], []], [subjectQueryUrl]]);
  });

  it("signs out the token refused for the search, fails a person with a blank name or kind as Unavailable, and drops the people found for a token that changed", async () => {
    const azure = new FakeAzure();
    azure.answer(new Response(null, { status: 401 }), FakeAzure.json({ value: [subject(1, " ")] }), FakeAzure.json({ value: [{ ...subject(1), subjectKind: " " }] }));
    const token = new FakeToken();
    const reads = new AzureReads(new AzureApi(azure.fetch), token);

    const failures: (string | null)[] = [];
    for (let i = 0; i < 3; i++)
      failures.push(failureOf(await reads.searchPeopleAsync(peopleQuery, signal).then(() => null, (t: unknown) => t)));
    const release = azure.hold();
    const searching = reads.searchPeopleAsync(peopleQuery, signal);
    await azure.askedAsync(4);
    token.answer("token", AzureCredential.ofToken("other-token"));
    release(FakeAzure.json({ value: [subject(1)] }));

    assert.deepEqual([failures, token.refused, await searching], [[FailureCode.Unauthorized, FailureCode.Unavailable, FailureCode.Unavailable], ["azure-token"], []]);
  });

  it("says the token can't read people when Graph refuses the search but the sign-in keeps it, and passes on the sign-out when it doesn't", async () => {
    const azure = new FakeAzure();
    azure.answer(new Response(null, { status: 401 }), new Response(null, { status: 401 }));
    const scoped = new FakeToken();
    const revoked = new FakeToken();
    revoked.answer("refusedAsync", async () => {
      revoked.answer("token", null);
    });

    const messageOf = (error: unknown): readonly [string, string] | null => error instanceof MethodFailureException ? [error.failure.code, error.failure.message] : null;
    const cannotRead = messageOf(await new AzureReads(new AzureApi(azure.fetch), scoped).searchPeopleAsync(peopleQuery, signal).then(() => null, (t: unknown) => t));
    const signedOut = messageOf(await new AzureReads(new AzureApi(azure.fetch), revoked).searchPeopleAsync(peopleQuery, signal).then(() => null, (t: unknown) => t));

    assert.deepEqual([cannotRead, signedOut, scoped.refused, revoked.refused], [[FailureCode.Unauthorized, "The Azure DevOps token can't read the organization's people; it needs the Graph (Read) scope."],
      [FailureCode.Unauthorized, "Sign in to Azure DevOps first."], ["azure-token"], ["azure-token"]]);
  });
});
