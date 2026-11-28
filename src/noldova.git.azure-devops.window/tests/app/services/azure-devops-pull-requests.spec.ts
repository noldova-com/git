/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type Signal } from "@angular/core";
import "@noldova/context.core";
import { FailureCode } from "@noldova/desktop.protocol";
import { RuntimeRequestException } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { BranchPullRequest, BranchQuery, CheckState, CommitQuery, HostAccount, HostAccountEntry, HostAccountList, HostChanges, HostCheck, HostCommitComments, HostItem,
  HostPullRequestHead, HostPullRequestHeads, HostPullRequestList, HostPullRequestRow, HostReference, HostReviewRequest, HostReviewRequestList, HostSignIn,
  ReferenceKind, ReferenceState, RepositoryQuery, ReviewDecision } from "@noldova/git.hosting.protocol";
import { GitRemote, RemoteTransport } from "@noldova/git.protocol";
import { GitBranchPullRequest, GitCommitComments, GitPullRequestList, GitPullRequestRow, GitPullRequestState, GitPullRequestsState } from "@noldova/git.window";
import { describe, expect, it } from "vitest";

import { AzureDevOpsPullRequests } from "../../../src/app/services/azure-devops-pull-requests.ts";
import { PullRequestPages } from "../../../src/app/services/pull-request-pages.ts";
import { RequestAnswers } from "../../fixtures/request-answers.fixture.ts";
import { UnhandledRejections } from "../../fixtures/unhandled-rejections.fixture.ts";
import { Wait } from "../../fixtures/wait.fixture.ts";
import { WindowFailure } from "../../fixtures/window-failure.fixture.ts";

const FOLDER: string = "/work/site";
const COMMENTED: string = "6dcb09b5b57875f334f61aebed695e2e4193db5e";
const UNCOMMENTED: string = "7638417db6d59f3c431d3e1f261cc637155684cd";
const UNANSWERED: string = "Azure DevOps didn't answer. Try again to read this repository's pull requests.";
const REPOSITORY: string = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const URL: string = "https://dev.azure.com/fabrikam/web/_git/site/pullrequest/752";
const remote: GitRemote = new GitRemote("origin", "dev.azure.com", "fabrikam/web/_git/site", RemoteTransport.Https);
const other: GitRemote = new GitRemote("origin", "dev.azure.com", "fabrikam/web/_git/docs", RemoteTransport.Https);
const row: HostPullRequestRow = new HostPullRequestRow(new HostReference("git-azure-devops", "fabrikam", REPOSITORY, 752), "Export notes as Markdown files",
  URL, true, 1, 2, 0, 1, "export-notes", "main");
const shown: GitPullRequestRow = new GitPullRequestRow(`fabrikam/${REPOSITORY}/752`, "!752", "Export notes as Markdown files", URL, true, 1, 2, 0, 1, "export-notes", "main");
const request: HostReviewRequest = new HostReviewRequest(new HostReference("git-azure-devops", "fabrikam", REPOSITORY, 533), "Sign in with a passkey",
  "https://dev.azure.com/fabrikam/web/_git/site/pullrequest/533", false, Date.parse("2026-11-20T09:00:00Z"));
const asked: GitPullRequestRow = new GitPullRequestRow(`fabrikam/${REPOSITORY}/533`, "!533", "Sign in with a passkey",
  "https://dev.azure.com/fabrikam/web/_git/site/pullrequest/533", false, 0, 0, 0, 0, "");

interface IOpenedPage {
  readonly url: string;
  readonly reference: HostReference;
}

class Host {
  public readonly context: FakeWindowPartContext = new FakeWindowPartContext();
  public readonly requests: RequestAnswers = new RequestAnswers(this.context);
  public readonly pages: IOpenedPage[] = [];
  public readonly pullRequests: AzureDevOpsPullRequests = new AzureDevOpsPullRequests(this.context, (url, reference) => this.pages.push({ url, reference }));

  public async readAsync(where: GitRemote, state: GitPullRequestsState): Promise<Signal<GitPullRequestList | null>> {
    const list = this.pullRequests.listFor(FOLDER, where);
    this.pullRequests.refresh(FOLDER, where);
    await Host.untilAsync(list, state);
    return list;
  }

  public static untilAsync(list: Signal<GitPullRequestList | null>, state: GitPullRequestsState): Promise<void> {
    return Wait.until(() => {
      if (list()?.state !== state)
        throw new Error(`The list isn't ${state} yet.`);
    });
  }
}

describe("AzureDevOpsPullRequests", () => {
  it("claims Azure DevOps remotes only, names the host and the accounts page, and has no list before it reads", () => {
    const host = new Host();
    const claimed = ["dev.azure.com", "ssh.dev.azure.com", "vs-ssh.visualstudio.com", "fabrikam.visualstudio.com", "github.com", null]
      .map(t => host.pullRequests.claims(new GitRemote("origin", t, "fabrikam/web/_git/site", RemoteTransport.Https)));

    expect([claimed, host.pullRequests.hostName, host.pullRequests.signInPage, host.pullRequests.listFor(FOLDER, remote)()]).toEqual([
      [true, true, true, true, false, false], "Azure DevOps", "git.accounts", null]);
  });

  it("opens a new pull request on the repository's create page from a web, SSH or collection remote, and has none for a path it can't read", () => {
    const host = new Host();
    const remotes: GitRemote[] = [
      remote, new GitRemote("origin", "ssh.dev.azure.com", "v3/fabrikam/My%20Web/site", RemoteTransport.Ssh),
      new GitRemote("origin", "fabrikam.visualstudio.com", "DefaultCollection/web/_git/site", RemoteTransport.Https),
      new GitRemote("origin", "dev.azure.com", "fabrikam/web/site", RemoteTransport.Https)
    ];

    expect(remotes.map(t => host.pullRequests.newPullRequestUrl(t, "feature/a b", "main"))).toEqual([
      "https://dev.azure.com/fabrikam/web/_git/site/pullrequestcreate?sourceRef=feature%2Fa%20b&targetRef=main",
      "https://dev.azure.com/fabrikam/My%20Web/_git/site/pullrequestcreate?sourceRef=feature%2Fa%20b&targetRef=main",
      "https://dev.azure.com/fabrikam/web/_git/site/pullrequestcreate?sourceRef=feature%2Fa%20b&targetRef=main",
      null
    ]);
  });

  it("reads the remote's pull requests and lists each, keyed by its document's instance and labelled by its number", async () => {
    const host = new Host();
    host.requests.answer(AzureDevOpsNames.readPullRequestsMethod, new HostPullRequestList([row], false).toJson());

    const list = await host.readAsync(remote, GitPullRequestsState.Ready);

    expect([host.requests.methods, host.requests.payloads]).toEqual([[AzureDevOpsNames.readPullRequestsMethod],
      [new RepositoryQuery("dev.azure.com", "fabrikam/web/_git/site").toJson()]]);
    expect(list()).toEqual(GitPullRequestList.ready([shown]));
    expect(host.pullRequests.listFor(FOLDER, remote)).toBe(list);
    expect(host.pages).toEqual([{ url: URL, reference: row.reference }]);
  });

  it("keeps the rows it showed while it reads again, and gives another remote its own list", async () => {
    const host = new Host();
    host.requests.answer(AzureDevOpsNames.readPullRequestsMethod, new HostPullRequestList([row], false).toJson());
    const release = host.requests.hold(AzureDevOpsNames.readPullRequestsMethod);
    const list = await host.readAsync(remote, GitPullRequestsState.Ready);

    host.pullRequests.refresh(FOLDER, remote);
    await host.requests.askedAsync(2);
    const reading = list();
    release(new HostPullRequestList([], false).toJson());
    await Host.untilAsync(list, GitPullRequestsState.Ready);

    expect([reading, list(), host.pullRequests.listFor(FOLDER, other)()]).toEqual([GitPullRequestList.reading([shown]), GitPullRequestList.ready([]), null]);
  });

  it("says nobody is signed in when Azure DevOps reads none for that reason", async () => {
    const host = new Host();
    host.requests.answer(AzureDevOpsNames.readPullRequestsMethod, HostPullRequestList.signedOut().toJson());

    const list = await host.readAsync(remote, GitPullRequestsState.SignedOut);

    expect(list()).toEqual(GitPullRequestList.signedOut());
  });

  it("shows the runtime's message for a failed read, says plainly that the window failed, and logs both", async () => {
    const host = new Host();
    host.requests.fail(AzureDevOpsNames.readPullRequestsMethod, new RuntimeRequestException(FailureCode.Unavailable, "The organization isn't reachable."));
    host.requests.fail(AzureDevOpsNames.readPullRequestsMethod, new WindowFailure("The runtime stopped."));

    const list = await host.readAsync(remote, GitPullRequestsState.Failed);
    const runtime = list();
    host.pullRequests.refresh(FOLDER, remote);
    await Wait.until(() => {
      if (list()?.failure !== UNANSWERED)
        throw new Error("The second read hasn't failed yet.");
    });

    expect([runtime, list()]).toEqual([GitPullRequestList.failed("The organization isn't reachable."),
      GitPullRequestList.failed(UNANSWERED)]);
    expect(host.context.callsOf("log")).toHaveLength(2);
  });

  it("drops an answer or failure a newer read overtook", async () => {
    const host = new Host();
    const release = host.requests.hold(AzureDevOpsNames.readPullRequestsMethod);
    const reject = host.requests.holdFailure(AzureDevOpsNames.readPullRequestsMethod);
    host.requests.answer(AzureDevOpsNames.readPullRequestsMethod, new HostPullRequestList([row], false).toJson());
    const list = host.pullRequests.listFor(FOLDER, remote);

    host.pullRequests.refresh(FOLDER, remote);
    host.pullRequests.refresh(FOLDER, remote);
    host.pullRequests.refresh(FOLDER, remote);
    await Host.untilAsync(list, GitPullRequestsState.Ready);
    release(new HostPullRequestList([], false).toJson());
    reject(new WindowFailure("The runtime stopped."));
    await host.requests.askedAsync(3);
    await Promise.allSettled(host.requests.answered);

    expect(list()).toEqual(GitPullRequestList.ready([shown]));
  });

  it("reads nothing, and has no list, for a remote with no host or no path", () => {
    const host = new Host();
    const pathless = new GitRemote("origin", "dev.azure.com", null, RemoteTransport.Https);
    const hostless = new GitRemote("origin", null, null, RemoteTransport.Https);

    host.pullRequests.refresh(FOLDER, pathless);
    host.pullRequests.refresh(FOLDER, hostless);

    expect([host.requests.methods, host.pullRequests.listFor(FOLDER, pathless)(), host.pullRequests.listFor(FOLDER, hostless)()]).toEqual([[], null, null]);
  });

  it("passes on a failure that isn't the window's", async () => {
    const host = new Host();
    const unexpected = new TypeError("Unexpected.");
    host.requests.fail(AzureDevOpsNames.readPullRequestsMethod, unexpected);
    const rejected = UnhandledRejections.nextAsync();

    host.pullRequests.refresh(FOLDER, remote);

    expect(await rejected).toBe(unexpected);
    expect(host.context.callsOf("log")).toEqual([]);
  });

  it("says a row is shown while its pull request's page is the active document", () => {
    const host = new Host();
    const before: boolean = host.pullRequests.isShown(FOLDER, shown);
    const unfollow = PullRequestPages.follow(signal(shown.key), signal(true));
    const front: boolean = host.pullRequests.isShown(FOLDER, shown);
    unfollow();

    expect([before, front, host.pullRequests.isShown(FOLDER, shown)]).toEqual([false, true, false]);
  });

  it("opens a row in its pull request document, titled by its label and title, and leaves a row it can't name to the browser", () => {
    const host = new Host();

    const opened = host.pullRequests.open(FOLDER, shown);
    const unnamed = host.pullRequests.open(FOLDER, new GitPullRequestRow("fabrikam/752", "!752", "Other", URL, false, 0, 0, 0, 0, "other"));

    expect([opened, unnamed, host.context.callsOf("openDocument")]).toEqual([true, false,
      [["git-azure-devops.pullRequest", `fabrikam/${REPOSITORY}/752`, "!752 Export notes as Markdown files"]]]);
  });
});

const HEAD: string = "6dcb09b5b57875f334f61aebed695e2e4193db5e";
const BRANCH_UNANSWERED: string = "Azure DevOps didn't answer. Its pull request reads again when the window takes the focus.";
const COMMIT_UNANSWERED: string = "Azure DevOps didn't answer. Its pull request reads again when the commit opens again.";
const signedIn = HostSignIn.signedIn(new HostAccount("monalisa@fabrikam.test", "Mona Lisa", null, [])).toJson();
const checks: readonly HostCheck[] = [new HostCheck("site-ci", CheckState.Succeeded, null), new HostCheck("Comment requirements", CheckState.Failed, null),
  new HostCheck("Build", CheckState.Running, null), new HostCheck("Status", CheckState.Neutral, null)];

function pullRequestOf(state: ReferenceState, decision: ReviewDecision = ReviewDecision.Waiting, approvals: number | null = 2): BranchPullRequest {
  const isOpen: boolean = state === ReferenceState.Open || state === ReferenceState.Draft;
  return new BranchPullRequest(new HostItem(new HostReference("git-azure-devops", "fabrikam", REPOSITORY, 752), ReferenceKind.PullRequest, state,
    "Export notes as Markdown files", URL, null, 1_800_000_000_000, isOpen ? null : 1_800_000_100_000, 0, HostChanges.uncounted("export-notes", "main", HEAD)),
  checks, decision, approvals);
}

function rowOf(approvals: number, isDraft: boolean = false, headBranch: string = "export-notes"): GitPullRequestRow {
  return new GitPullRequestRow(`fabrikam/${REPOSITORY}/752`, "!752", "Export notes as Markdown files", URL, isDraft, approvals, 1, 1, 1, headBranch, "main");
}

function untilAsync(answer: Signal<GitBranchPullRequest | null>, state: GitPullRequestsState): Promise<void> {
  return Wait.until(() => {
    if (answer()?.state !== state)
      throw new Error(`The answer isn't ${state} yet.`);
  });
}

async function branchAsync(host: Host, branch: string, state: GitPullRequestsState = GitPullRequestsState.Ready): Promise<GitBranchPullRequest | null> {
  const answer = host.pullRequests.branchFor(FOLDER, remote, branch, HEAD);
  host.pullRequests.refreshBranch(FOLDER, remote, branch, HEAD);
  await untilAsync(answer, state);
  return answer();
}

describe("AzureDevOpsPullRequests, a branch's and a commit's pull request", () => {
  it("reads a branch's newest pull request with the sign-in, counting its checks and approvals, and answers the same signal for the branch and head", async () => {
    const host = new Host();
    host.requests.answer(AzureDevOpsNames.readSignInMethod, signedIn);
    host.requests.answer(AzureDevOpsNames.readBranchPullRequestMethod, pullRequestOf(ReferenceState.Open).toJson());
    const before = host.pullRequests.branchFor(FOLDER, remote, "export-notes", HEAD)();

    const read = await branchAsync(host, "export-notes");

    expect([before, read, host.pullRequests.branchFor(FOLDER, remote, "export-notes", HEAD)(), host.pullRequests.branchFor(FOLDER, remote, "export-notes", null)()])
      .toEqual([null, GitBranchPullRequest.of(rowOf(2), GitPullRequestState.Open, true, "Active"), read, null]);
    expect([host.requests.methods, host.requests.payloads]).toEqual([[AzureDevOpsNames.readSignInMethod, AzureDevOpsNames.readBranchPullRequestMethod],
      [null, new BranchQuery("dev.azure.com", "fabrikam/web/_git/site", "export-notes", HEAD).toJson()]]);
    expect(host.pages).toEqual([{ url: URL, reference: new HostReference("git-azure-devops", "fabrikam", REPOSITORY, 752) }]);
  });

  it("maps each state with Azure DevOps' word for it, waits for review only while open without a decision, keeps the base branch, and answers none without a pull request", async () => {
    const host = new Host();
    const answers: BranchPullRequest[] = [pullRequestOf(ReferenceState.Draft), pullRequestOf(ReferenceState.Merged, ReviewDecision.Approved),
      pullRequestOf(ReferenceState.Closed, ReviewDecision.ChangesRequested, null), pullRequestOf(ReferenceState.Open, ReviewDecision.Approved),
      new BranchPullRequest(null, [])];
    for (const answer of answers) {
      host.requests.answer(AzureDevOpsNames.readSignInMethod, signedIn);
      host.requests.answer(AzureDevOpsNames.readBranchPullRequestMethod, answer.toJson());
    }

    const read: (GitBranchPullRequest | null)[] = [];
    for (const [index] of answers.entries())
      read.push(await branchAsync(host, `branch-${String(index)}`));

    expect(read).toEqual([GitBranchPullRequest.of(rowOf(2, true, "branch-0"), GitPullRequestState.Draft, false, "Draft"),
      GitBranchPullRequest.of(rowOf(2, false, "branch-1"), GitPullRequestState.Merged, false, "Completed"),
      GitBranchPullRequest.of(rowOf(0, false, "branch-2"), GitPullRequestState.Closed, false, "Abandoned"),
      GitBranchPullRequest.of(rowOf(2, false, "branch-3"), GitPullRequestState.Open, false, "Active"), GitBranchPullRequest.none(0, 0, 0)]);
  });

  it("says nobody is signed in when the sign-in read finds none", async () => {
    const host = new Host();
    host.requests.answer(AzureDevOpsNames.readSignInMethod, HostSignIn.signedOut().toJson());
    host.requests.answer(AzureDevOpsNames.readBranchPullRequestMethod, new BranchPullRequest(null, []).toJson());

    expect(await branchAsync(host, "export-notes", GitPullRequestsState.SignedOut)).toEqual(GitBranchPullRequest.signedOut());
  });

  it("keeps the last answer while it reads again, shows the runtime's message or that Azure DevOps didn't answer, and logs each", async () => {
    const host = new Host();
    host.requests.answer(AzureDevOpsNames.readSignInMethod, signedIn, signedIn, signedIn, signedIn);
    host.requests.answer(AzureDevOpsNames.readBranchPullRequestMethod, pullRequestOf(ReferenceState.Open).toJson());
    const release = host.requests.hold(AzureDevOpsNames.readBranchPullRequestMethod);
    host.requests.fail(AzureDevOpsNames.readBranchPullRequestMethod, new RuntimeRequestException(FailureCode.Unavailable, "The organization isn't reachable."));
    host.requests.fail(AzureDevOpsNames.readBranchPullRequestMethod, new WindowFailure("The runtime stopped."));
    const answer = host.pullRequests.branchFor(FOLDER, remote, "export-notes", HEAD);
    const first = await branchAsync(host, "export-notes");

    host.pullRequests.refreshBranch(FOLDER, remote, "export-notes", HEAD);
    await host.requests.askedAsync(4);
    const reading = answer();
    release(pullRequestOf(ReferenceState.Merged, ReviewDecision.Approved).toJson());
    await untilAsync(answer, GitPullRequestsState.Ready);
    const merged = answer();
    const refused = await branchAsync(host, "export-notes", GitPullRequestsState.Failed);
    host.pullRequests.refreshBranch(FOLDER, remote, "export-notes", HEAD);
    await Wait.until(() => {
      if (answer()?.failure !== BRANCH_UNANSWERED)
        throw new Error("The last read hasn't failed yet.");
    });

    expect([reading, merged, refused, answer()]).toEqual([GitBranchPullRequest.reading(first), GitBranchPullRequest.of(rowOf(2), GitPullRequestState.Merged, false, "Completed"),
      GitBranchPullRequest.failed("The organization isn't reachable."), GitBranchPullRequest.failed(BRANCH_UNANSWERED)]);
    expect(host.context.callsOf("log").map(t => String(t[0]).includes("git-azure-devops.readBranchPullRequest"))).toEqual([true, true]);
  });

  it("drops a branch's answer or failure a newer read overtook", async () => {
    const host = new Host();
    host.requests.answer(AzureDevOpsNames.readSignInMethod, signedIn, signedIn, signedIn);
    const release = host.requests.hold(AzureDevOpsNames.readBranchPullRequestMethod);
    const reject = host.requests.holdFailure(AzureDevOpsNames.readBranchPullRequestMethod);
    host.requests.answer(AzureDevOpsNames.readBranchPullRequestMethod, new BranchPullRequest(null, []).toJson());
    const answer = host.pullRequests.branchFor(FOLDER, remote, "export-notes", HEAD);

    for (let i = 0; i < 3; i++)
      host.pullRequests.refreshBranch(FOLDER, remote, "export-notes", HEAD);
    await untilAsync(answer, GitPullRequestsState.Ready);
    release(pullRequestOf(ReferenceState.Open).toJson());
    reject(new WindowFailure("The runtime stopped."));
    await Wait.until(() => {
      if (host.context.callsOf("log").length === 0)
        throw new Error("The overtaken failure isn't logged yet.");
    });

    expect(answer()).toEqual(GitBranchPullRequest.none(0, 0, 0));
  });

  it("reads a commit's pull request once for the page's life, with no head branch, and answers the same signal for it", async () => {
    const host = new Host();
    host.requests.answer(AzureDevOpsNames.readCommitPullRequestMethod, pullRequestOf(ReferenceState.Merged, ReviewDecision.Approved, 1).toJson());

    const answer = host.pullRequests.commitFor(FOLDER, remote, HEAD);
    await untilAsync(answer, GitPullRequestsState.Ready);

    expect([answer(), host.pullRequests.commitFor(FOLDER, remote, HEAD), host.requests.methods, host.requests.payloads]).toEqual([
      GitBranchPullRequest.of(rowOf(1, false, ""), GitPullRequestState.Merged, false, "Completed"), answer, [AzureDevOpsNames.readCommitPullRequestMethod],
      [new CommitQuery("dev.azure.com", "fabrikam/web/_git/site", HEAD).toJson()]]);
    expect(host.pages).toEqual([{ url: URL, reference: new HostReference("git-azure-devops", "fabrikam", REPOSITORY, 752) }]);
  });

  it("answers a commit's failed read as failed with the runtime's message or that Azure DevOps didn't answer, logs it, never retries that ask and keeps no "
    + "failure, so the commit reads again when it opens again", async () => {
    const host = new Host();
    host.requests.fail(AzureDevOpsNames.readCommitPullRequestMethod, new RuntimeRequestException(FailureCode.Unavailable, "The organization isn't reachable."));
    host.requests.fail(AzureDevOpsNames.readCommitPullRequestMethod, new WindowFailure("The runtime stopped."));
    host.requests.answer(AzureDevOpsNames.readCommitPullRequestMethod, pullRequestOf(ReferenceState.Merged, ReviewDecision.Approved, 1).toJson());

    const refused = host.pullRequests.commitFor(FOLDER, remote, HEAD);
    await untilAsync(refused, GitPullRequestsState.Failed);
    const asked: number = host.requests.methods.length;
    const unanswered = host.pullRequests.commitFor(FOLDER, remote, HEAD);
    await untilAsync(unanswered, GitPullRequestsState.Failed);
    const reopened = host.pullRequests.commitFor(FOLDER, remote, HEAD);
    await untilAsync(reopened, GitPullRequestsState.Ready);

    expect([refused(), asked, unanswered(), host.context.callsOf("log").map(t => String(t[0]).includes("git-azure-devops.readCommitPullRequest")), reopened(),
      host.requests.methods]).toEqual([GitBranchPullRequest.failed("The organization isn't reachable."), 1, GitBranchPullRequest.failed(COMMIT_UNANSWERED), [true, true],
      GitBranchPullRequest.of(rowOf(1, false, ""), GitPullRequestState.Merged, false, "Completed"), Array.from({ length: 3 }, () => AzureDevOpsNames.readCommitPullRequestMethod)]);
  });

  it("reads the remote's review requests into a list of its own, keyed by the remote and opened as its document, and says when there were more", async () => {
    const host = new Host();
    host.requests.answer(AzureDevOpsNames.readReviewRequestsMethod, new HostReviewRequestList([request], true).toJson());
    const reviews = host.pullRequests.reviewsFor(remote);
    const before = reviews();

    host.pullRequests.refreshReviews(remote);
    await Host.untilAsync(reviews, GitPullRequestsState.Ready);

    expect([before, reviews(), host.pullRequests.reviewsFor(remote) === reviews, host.pullRequests.reviewsFor(other)(), host.pullRequests.listFor(FOLDER, remote)(),
      host.pullRequests.open(FOLDER, asked)]).toEqual([null, GitPullRequestList.ready([asked], true), true, null, null, true]);
    expect([host.requests.methods, host.requests.payloads]).toEqual([[AzureDevOpsNames.readReviewRequestsMethod],
      [new RepositoryQuery("dev.azure.com", "fabrikam/web/_git/site").toJson()]]);
    expect(host.pages).toEqual([{ url: request.url, reference: request.reference }]);
  });

  it("reads the review requests again when an added account signs in, out or leaves, but not for the first account, a waiting sign-in or an unchanged list", async () => {
    const host = new Host();
    const octocat = HostSignIn.signedIn(new HostAccount("octocat", null, null, []));
    const waiting = HostSignIn.waitingInBrowser("https://login.microsoftonline.com/example");
    const listOf = (...entries: [number, HostSignIn][]): HostAccountList => new HostAccountList(entries.map(([id, t]) => new HostAccountEntry(id, t)));
    host.requests.answer(AzureDevOpsNames.readReviewRequestsMethod, ...Array.from({ length: 4 }, () => new HostReviewRequestList([request], false).toJson()));
    const reviews = host.pullRequests.reviewsFor(remote);
    host.pullRequests.refreshReviews(remote);
    await Host.untilAsync(reviews, GitPullRequestsState.Ready);
    const counts: number[] = [];

    for (const list of [listOf([1, octocat]), listOf([1, HostSignIn.signedOut()]), listOf([1, octocat], [2, waiting]), listOf([1, octocat], [2, waiting]),
      listOf([1, octocat], [2, octocat]), listOf([1, octocat], [2, octocat]), listOf([1, octocat], [2, HostSignIn.signedOut()]), listOf([1, octocat])]) {
      host.context.raiseEvent(AzureDevOpsNames.accountsChangedEvent, list.toJson());
      await Promise.allSettled(host.requests.answered);
      counts.push(host.requests.methods.length);
    }
    host.pullRequests.stop();

    expect([counts, reviews()]).toEqual([[1, 1, 1, 1, 2, 2, 3, 4], GitPullRequestList.ready([asked])]);
    expect(host.context.activeCallsOf("onEvent")).toEqual([]);
  });

  it("keeps the account each review request was listed for on its row", async () => {
    const host = new Host();
    host.requests.answer(AzureDevOpsNames.readReviewRequestsMethod, new HostReviewRequestList([new HostReviewRequest(request.reference, request.title, request.url,
      request.isDraft, request.createdAt, "octocat")], false).toJson());
    const reviews = host.pullRequests.reviewsFor(remote);

    host.pullRequests.refreshReviews(remote);
    await Host.untilAsync(reviews, GitPullRequestsState.Ready);

    expect([reviews()?.rows.map(t => t.account), asked.account]).toEqual([["octocat"], null]);
  });

  it("keeps the review requests it showed while it reads again and after a failed read, logging it, and says when nobody is signed in", async () => {
    const host = new Host();
    host.requests.answer(AzureDevOpsNames.readReviewRequestsMethod, new HostReviewRequestList([request], false).toJson());
    const release = host.requests.hold(AzureDevOpsNames.readReviewRequestsMethod);
    host.requests.fail(AzureDevOpsNames.readReviewRequestsMethod, new RuntimeRequestException(FailureCode.Unavailable, "Azure DevOps refused the request (503)."));
    host.requests.fail(AzureDevOpsNames.readReviewRequestsMethod, new WindowFailure("The runtime stopped."));
    host.requests.answer(AzureDevOpsNames.readReviewRequestsMethod, HostReviewRequestList.signedOut().toJson());
    const reviews = host.pullRequests.reviewsFor(remote);
    const states: (GitPullRequestList | null)[] = [];

    for (const state of [GitPullRequestsState.Ready, GitPullRequestsState.Ready, GitPullRequestsState.Failed, GitPullRequestsState.Failed,
      GitPullRequestsState.SignedOut]) {
      host.pullRequests.refreshReviews(remote);
      if (states.length === 1) {
        states.push(reviews());
        release(new HostReviewRequestList([request], false).toJson());
      }
      await Host.untilAsync(reviews, state);
      states.push(reviews());
    }

    expect(states).toEqual([GitPullRequestList.ready([asked]), GitPullRequestList.reading([asked]), GitPullRequestList.ready([asked]),
      GitPullRequestList.failed("Azure DevOps refused the request (503).", [asked]), GitPullRequestList.failed(UNANSWERED, [asked]), GitPullRequestList.signedOut()]);
    expect(host.context.callsOf("log").map(t => String(t[0]))).toEqual([
      "The Azure DevOps module's git-azure-devops.readReviewRequests request failed: RuntimeRequestException: Azure DevOps refused the request (503).",
      "The Azure DevOps module's git-azure-devops.readReviewRequests request failed: WindowFailure: The runtime stopped."]);
  });

  it("drops a review answer or failure a newer read overtook, reads nothing for a remote with no host or path, and passes on a failure that isn't the window's",
    async () => {
      const host = new Host();
      const release = host.requests.hold(AzureDevOpsNames.readReviewRequestsMethod);
      const reject = host.requests.holdFailure(AzureDevOpsNames.readReviewRequestsMethod);
      host.requests.answer(AzureDevOpsNames.readReviewRequestsMethod, new HostReviewRequestList([request], false).toJson());
      const unexpected = new TypeError("Unexpected.");
      host.requests.fail(AzureDevOpsNames.readReviewRequestsMethod, unexpected);
      const reviews = host.pullRequests.reviewsFor(remote);

      host.pullRequests.refreshReviews(remote);
      host.pullRequests.refreshReviews(remote);
      host.pullRequests.refreshReviews(remote);
      await Host.untilAsync(reviews, GitPullRequestsState.Ready);
      release(new HostReviewRequestList([], false).toJson());
      reject(new WindowFailure("The runtime stopped."));
      await host.requests.askedAsync(3);
      await Promise.allSettled(host.requests.answered);
      const overtaken = reviews();
      host.pullRequests.refreshReviews(new GitRemote("origin", "dev.azure.com", null, RemoteTransport.Https));
      host.pullRequests.refreshReviews(new GitRemote("origin", null, null, RemoteTransport.Https));
      const rejected = UnhandledRejections.nextAsync();
      host.pullRequests.refreshReviews(remote);

      expect([overtaken, await rejected, host.requests.methods.length]).toEqual([GitPullRequestList.ready([asked]), unexpected, 4]);
    });

  it("reads a commit's review comments once for each remote and commit, and gives another commit its own read", async () => {
    const host = new Host();
    host.requests.answer(AzureDevOpsNames.readCommitCommentsMethod, new HostCommitComments(3, true, "https://dev.azure.com/fabrikam/web/_git/site/pullrequest/752?_a=files&iteration=3").toJson());
    host.requests.answer(AzureDevOpsNames.readCommitCommentsMethod, HostCommitComments.none().toJson());
    const comments = host.pullRequests.commentsFor(FOLDER, remote, COMMENTED);
    const before = comments();

    await Wait.until(() => {
      if (Object.isNull(comments()))
        throw new Error("The comments aren't read yet.");
    });
    const again = host.pullRequests.commentsFor(FOLDER, remote, COMMENTED);
    const otherCommit = host.pullRequests.commentsFor(FOLDER, remote, UNCOMMENTED);
    await Wait.until(() => {
      if (Object.isNull(otherCommit()))
        throw new Error("The other commit's comments aren't read yet.");
    });

    expect([before, comments(), again === comments, otherCommit()]).toEqual([null, new GitCommitComments(3, true, "https://dev.azure.com/fabrikam/web/_git/site/pullrequest/752?_a=files&iteration=3"), true,
      new GitCommitComments(0, false, null)]);
    expect([host.requests.methods, host.requests.payloads]).toEqual([[AzureDevOpsNames.readCommitCommentsMethod, AzureDevOpsNames.readCommitCommentsMethod],
      [new CommitQuery("dev.azure.com", "fabrikam/web/_git/site", COMMENTED).toJson(), new CommitQuery("dev.azure.com", "fabrikam/web/_git/site", UNCOMMENTED).toJson()]]);
  });

  it("logs a failed comments read and forgets it so the next ask reads again, reads nothing for a remote with no host or path, and passes on a failure that isn't the window's",
    async () => {
      const host = new Host();
      host.requests.fail(AzureDevOpsNames.readCommitCommentsMethod, new RuntimeRequestException(FailureCode.Unavailable, "Azure DevOps refused the request (503)."));
      host.requests.answer(AzureDevOpsNames.readCommitCommentsMethod, new HostCommitComments(2, false, "https://dev.azure.com/fabrikam/web/_git/site/pullrequest/752?_a=files&iteration=3").toJson());
      const unexpected = new TypeError("Unexpected.");
      host.requests.fail(AzureDevOpsNames.readCommitCommentsMethod, unexpected);

      const failed = host.pullRequests.commentsFor(FOLDER, remote, COMMENTED);
      await Wait.until(() => {
        if (host.context.callsOf("log").length === 0)
          throw new Error("The failure isn't logged yet.");
      });
      const retried = host.pullRequests.commentsFor(FOLDER, remote, COMMENTED);
      await Wait.until(() => {
        if (Object.isNull(retried()))
          throw new Error("The comments aren't read again yet.");
      });
      const hostless = host.pullRequests.commentsFor(FOLDER, new GitRemote("origin", null, null, RemoteTransport.Https), COMMENTED)();
      const pathless = host.pullRequests.commentsFor(FOLDER, new GitRemote("origin", "dev.azure.com", null, RemoteTransport.Https), COMMENTED)();
      const rejected = UnhandledRejections.nextAsync();
      host.pullRequests.commentsFor(FOLDER, other, COMMENTED);

      expect([failed(), retried === failed, retried(), hostless, pathless, await rejected, host.requests.methods.length]).toEqual([null, false,
        new GitCommitComments(2, false, "https://dev.azure.com/fabrikam/web/_git/site/pullrequest/752?_a=files&iteration=3"), null, null, unexpected, 3]);
      expect(host.context.callsOf("log").map(t => String(t[0]))).toEqual([
        "The Azure DevOps module's git-azure-devops.readCommitComments request failed: RuntimeRequestException: Azure DevOps refused the request (503)."]);
    });

  it("reads a remote's heads, up to 100 and whether there are more, once into a list apart from the open list, and another remote's apart", async () => {
    const host = new Host();
    const urlOf = (number: number): string => `https://dev.azure.com/fabrikam/web/_git/site/pullrequest/${number}`;
    host.requests.answer(AzureDevOpsNames.readPullRequestHeadsMethod, new HostPullRequestHeads(Array.from({ length: 100 }, (_t, i) => new HostPullRequestHead(
      new HostReference("git-azure-devops", "fabrikam", REPOSITORY, i + 1), `Change ${i + 1}`, urlOf(i + 1), `change-${i + 1}`, i === 0 ? null : `change-${i}`)),
    true).toJson());
    host.requests.answer(AzureDevOpsNames.readPullRequestHeadsMethod, HostPullRequestHeads.signedOut().toJson());
    const stacks = host.pullRequests.stackListFor(FOLDER, remote);
    const before = stacks();

    await Wait.until(() => {
      if (Object.isNull(stacks()))
        throw new Error("The heads aren't read yet.");
    });
    const again = host.pullRequests.stackListFor(FOLDER, remote);
    const otherList = host.pullRequests.stackListFor(FOLDER, other);
    await Wait.until(() => {
      if (Object.isNull(otherList()))
        throw new Error("The other remote's heads aren't read yet.");
    });

    expect([before, stacks(), again === stacks, otherList(), host.pullRequests.listFor(FOLDER, remote)()]).toEqual([null,
      GitPullRequestList.ready(Array.from({ length: 100 }, (_t, i) => new GitPullRequestRow(`fabrikam/${REPOSITORY}/${i + 1}`, `!${i + 1}`, `Change ${i + 1}`,
        urlOf(i + 1), false, 0, 0, 0, 0, `change-${i + 1}`, i === 0 ? null : `change-${i}`)), true), true, GitPullRequestList.signedOut(), null]);
    expect([host.requests.methods, host.requests.payloads]).toEqual([[AzureDevOpsNames.readPullRequestHeadsMethod, AzureDevOpsNames.readPullRequestHeadsMethod],
      [new RepositoryQuery("dev.azure.com", "fabrikam/web/_git/site").toJson(), new RepositoryQuery("dev.azure.com", "fabrikam/web/_git/docs").toJson()]]);
    expect([host.pages.length, host.pages[0]]).toEqual([100, { url: urlOf(1), reference: new HostReference("git-azure-devops", "fabrikam", REPOSITORY, 1) }]);
  });

  it("logs a failed heads read and forgets it so the next ask reads again, reads nothing for a remote with no host or path, and passes on a failure that isn't the window's",
    async () => {
      const host = new Host();
      host.requests.fail(AzureDevOpsNames.readPullRequestHeadsMethod, new RuntimeRequestException(FailureCode.Unavailable, "Azure DevOps refused the request (503)."));
      host.requests.answer(AzureDevOpsNames.readPullRequestHeadsMethod, new HostPullRequestHeads([], false).toJson());
      const unexpected = new TypeError("Unexpected.");
      host.requests.fail(AzureDevOpsNames.readPullRequestHeadsMethod, unexpected);

      const failed = host.pullRequests.stackListFor(FOLDER, remote);
      await Wait.until(() => {
        if (host.context.callsOf("log").length === 0)
          throw new Error("The failure isn't logged yet.");
      });
      const retried = host.pullRequests.stackListFor(FOLDER, remote);
      await Wait.until(() => {
        if (Object.isNull(retried()))
          throw new Error("The heads aren't read again yet.");
      });
      const hostless = host.pullRequests.stackListFor(FOLDER, new GitRemote("origin", null, null, RemoteTransport.Https))();
      const pathless = host.pullRequests.stackListFor(FOLDER, new GitRemote("origin", "dev.azure.com", null, RemoteTransport.Https))();
      const rejected = UnhandledRejections.nextAsync();
      host.pullRequests.stackListFor(FOLDER, other);

      expect([failed(), retried === failed, retried(), hostless, pathless, await rejected, host.requests.methods.length]).toEqual([null, false,
        GitPullRequestList.ready([]), null, null, unexpected, 3]);
      expect(host.context.callsOf("log").map(t => String(t[0]))).toEqual([
        "The Azure DevOps module's git-azure-devops.readPullRequestHeads request failed: RuntimeRequestException: Azure DevOps refused the request (503)."]);
    });

  it("reads a repository whose project's name has a space with each query, from a remote that gives it decoded or encoded", async () => {
    const host = new Host();
    const spaced = new GitRemote("origin", "dev.azure.com", "fabrikam/Sample Project/_git/site", RemoteTransport.Https);
    const escaped = new GitRemote("origin", "ssh.dev.azure.com", "v3/fabrikam/Sample%20Project/site", RemoteTransport.Ssh);
    const path: string = "fabrikam/Sample%20Project/_git/site";
    host.requests.answer(AzureDevOpsNames.readSignInMethod, signedIn);
    host.requests.answer(AzureDevOpsNames.readPullRequestsMethod, new HostPullRequestList([], false).toJson());
    host.requests.answer(AzureDevOpsNames.readBranchPullRequestMethod, new BranchPullRequest(null, []).toJson());
    host.requests.answer(AzureDevOpsNames.readPullRequestHeadsMethod, HostPullRequestHeads.signedOut().toJson());
    host.requests.answer(AzureDevOpsNames.readCommitPullRequestMethod, new BranchPullRequest(null, []).toJson());
    host.requests.answer(AzureDevOpsNames.readCommitCommentsMethod, HostCommitComments.none().toJson());
    host.requests.answer(AzureDevOpsNames.readReviewRequestsMethod, new HostReviewRequestList([], false).toJson());

    host.pullRequests.refresh(FOLDER, spaced);
    host.pullRequests.refreshBranch(FOLDER, spaced, "export-notes", HEAD);
    host.pullRequests.stackListFor(FOLDER, spaced);
    host.pullRequests.commitFor(FOLDER, spaced, HEAD);
    host.pullRequests.commentsFor(FOLDER, escaped, COMMENTED);
    host.pullRequests.refreshReviews(escaped);
    await Wait.until(() => {
      if (host.requests.methods.length < 7)
        throw new Error("The queries aren't all asked yet.");
    });

    expect(host.requests.payloads.filter(t => !Object.isNull(t))).toEqual(expect.arrayContaining([new RepositoryQuery("dev.azure.com", path).toJson(),
      new BranchQuery("dev.azure.com", path, "export-notes", HEAD).toJson(), new CommitQuery("dev.azure.com", path, HEAD).toJson(),
      new CommitQuery("ssh.dev.azure.com", "v3/fabrikam/Sample%20Project/site", COMMENTED).toJson(),
      new RepositoryQuery("ssh.dev.azure.com", "v3/fabrikam/Sample%20Project/site").toJson()]));
    expect(host.requests.payloads.filter(t => !Object.isNull(t)).length).toBe(6);
  });

  it("reads no branch or commit, and has no answer, for a remote with no host or no path", () => {
    const host = new Host();
    const pathless = new GitRemote("origin", "dev.azure.com", null, RemoteTransport.Https);
    const hostless = new GitRemote("origin", null, null, RemoteTransport.Https);

    host.pullRequests.refreshBranch(FOLDER, pathless, "export-notes", HEAD);
    host.pullRequests.refreshBranch(FOLDER, hostless, "export-notes", HEAD);

    expect([host.pullRequests.commitFor(FOLDER, pathless, HEAD)(), host.pullRequests.commitFor(FOLDER, hostless, HEAD)(),
      host.pullRequests.branchFor(FOLDER, pathless, "export-notes", HEAD)(), host.requests.methods]).toEqual([null, null, null, []]);
  });

  it("passes on a branch's or a commit's failure that isn't the window's", async () => {
    const host = new Host();
    const branch = new TypeError("Unexpected branch.");
    const commit = new TypeError("Unexpected commit.");
    host.requests.answer(AzureDevOpsNames.readSignInMethod, signedIn);
    host.requests.fail(AzureDevOpsNames.readBranchPullRequestMethod, branch);
    host.requests.fail(AzureDevOpsNames.readCommitPullRequestMethod, commit);

    const branchRejected = UnhandledRejections.nextAsync();
    host.pullRequests.refreshBranch(FOLDER, remote, "export-notes", HEAD);
    const first = await branchRejected;
    const commitRejected = UnhandledRejections.nextAsync();
    host.pullRequests.commitFor(FOLDER, remote, HEAD);

    expect([first, await commitRejected, host.context.callsOf("log")]).toEqual([branch, commit, []]);
  });

  it("reads every list, branch, stack, commit and comment count it read again when someone signs in or out, but not while a sign-in waits or once it stops",
    async () => {
      const host = new Host();
      const methods: readonly string[] = [AzureDevOpsNames.readPullRequestsMethod, AzureDevOpsNames.readReviewRequestsMethod, AzureDevOpsNames.readBranchPullRequestMethod,
        AzureDevOpsNames.readPullRequestHeadsMethod, AzureDevOpsNames.readCommitPullRequestMethod, AzureDevOpsNames.readCommitCommentsMethod];
      const count = (): number[] => methods.map(t => host.requests.methods.filter(m => m === t).length);
      host.requests.answer(AzureDevOpsNames.readPullRequestsMethod, HostPullRequestList.signedOut().toJson(), new HostPullRequestList([row], false).toJson(),
        HostPullRequestList.signedOut().toJson());
      host.requests.answer(AzureDevOpsNames.readSignInMethod, HostSignIn.signedOut().toJson(), signedIn, HostSignIn.signedOut().toJson());
      host.requests.otherwise(AzureDevOpsNames.readReviewRequestsMethod, HostReviewRequestList.signedOut().toJson())
        .otherwise(AzureDevOpsNames.readBranchPullRequestMethod, pullRequestOf(ReferenceState.Open).toJson())
        .otherwise(AzureDevOpsNames.readPullRequestHeadsMethod, HostPullRequestHeads.signedOut().toJson())
        .otherwise(AzureDevOpsNames.readCommitPullRequestMethod, pullRequestOf(ReferenceState.Merged, ReviewDecision.Approved, 1).toJson())
        .otherwise(AzureDevOpsNames.readCommitCommentsMethod, HostCommitComments.none().toJson());
      const list = await host.readAsync(remote, GitPullRequestsState.SignedOut);
      const branch = await branchAsync(host, "export-notes", GitPullRequestsState.SignedOut);
      host.pullRequests.reviewsFor(remote);
      host.pullRequests.refreshReviews(remote);
      host.pullRequests.stackListFor(FOLDER, remote);
      host.pullRequests.commitFor(FOLDER, remote, HEAD);
      host.pullRequests.commentsFor(FOLDER, remote, COMMENTED);
      await host.requests.askedAsync(7);

      host.context.raiseEvent(AzureDevOpsNames.signInChangedEvent, HostSignIn.waitingInBrowser("https://login.microsoftonline.com/example").toJson());
      const whileWaiting = count();
      host.context.raiseEvent(AzureDevOpsNames.signInChangedEvent, signedIn);
      await Host.untilAsync(list, GitPullRequestsState.Ready);
      const answer = host.pullRequests.branchFor(FOLDER, remote, "export-notes", HEAD);
      await untilAsync(answer, GitPullRequestsState.Ready);
      const onSignIn = [list(), answer(), count()];
      host.context.raiseEvent(AzureDevOpsNames.signInChangedEvent, HostSignIn.signedOut().toJson());
      await Host.untilAsync(list, GitPullRequestsState.SignedOut);
      await untilAsync(answer, GitPullRequestsState.SignedOut);
      host.pullRequests.stop();
      host.context.raiseEvent(AzureDevOpsNames.signInChangedEvent, signedIn);

      expect([branch, whileWaiting, count(), host.context.activeCallsOf("onEvent")]).toEqual([GitBranchPullRequest.signedOut(), [1, 1, 1, 1, 1, 1],
        [3, 3, 3, 3, 3, 3], []]);
      expect(onSignIn).toEqual([GitPullRequestList.ready([shown]), GitBranchPullRequest.of(rowOf(2), GitPullRequestState.Open, true, "Active"), [2, 2, 2, 2, 2, 2]]);
    });


  it("keeps a sign-in's stack list, commit pull request and comment count when an earlier read answers after it", async () => {
    const host = new Host();
    const stale = [host.requests.hold(AzureDevOpsNames.readPullRequestHeadsMethod), host.requests.hold(AzureDevOpsNames.readCommitPullRequestMethod),
      host.requests.hold(AzureDevOpsNames.readCommitCommentsMethod)];
    host.requests.answer(AzureDevOpsNames.readPullRequestHeadsMethod, new HostPullRequestHeads([], false).toJson());
    host.requests.answer(AzureDevOpsNames.readCommitPullRequestMethod, pullRequestOf(ReferenceState.Merged, ReviewDecision.Approved, 1).toJson());
    host.requests.answer(AzureDevOpsNames.readCommitCommentsMethod, new HostCommitComments(2, false, URL).toJson());
    const stacks = host.pullRequests.stackListFor(FOLDER, remote);
    const commit = host.pullRequests.commitFor(FOLDER, remote, HEAD);
    const comments = host.pullRequests.commentsFor(FOLDER, remote, COMMENTED);

    host.context.raiseEvent(AzureDevOpsNames.signInChangedEvent, signedIn);
    await Wait.until(() => expect([stacks()?.state, commit()?.state, comments()?.count]).toEqual([GitPullRequestsState.Ready, GitPullRequestsState.Ready, 2]));
    stale[0]?.(HostPullRequestHeads.signedOut().toJson());
    stale[1]?.(pullRequestOf(ReferenceState.Open).toJson());
    stale[2]?.(new HostCommitComments(5, false, URL).toJson());
    await Promise.allSettled(host.requests.answered);

    expect([stacks(), commit(), comments()]).toEqual([GitPullRequestList.ready([], false),
      GitBranchPullRequest.of(rowOf(1, false, ""), GitPullRequestState.Merged, false, "Completed"), new GitCommitComments(2, false, URL)]);
  });

  it("keeps a sign-in's answers when an earlier read fails after it, and reads them all again at the next sign-in", async () => {
    const host = new Host();
    const failures = [host.requests.holdFailure(AzureDevOpsNames.readPullRequestHeadsMethod), host.requests.holdFailure(AzureDevOpsNames.readCommitPullRequestMethod),
      host.requests.holdFailure(AzureDevOpsNames.readCommitCommentsMethod)];
    host.requests.otherwise(AzureDevOpsNames.readPullRequestHeadsMethod, new HostPullRequestHeads([], false).toJson())
      .otherwise(AzureDevOpsNames.readCommitPullRequestMethod, pullRequestOf(ReferenceState.Merged, ReviewDecision.Approved, 1).toJson())
      .otherwise(AzureDevOpsNames.readCommitCommentsMethod, new HostCommitComments(2, false, URL).toJson());
    const stacks = host.pullRequests.stackListFor(FOLDER, remote);
    const commit = host.pullRequests.commitFor(FOLDER, remote, HEAD);
    const comments = host.pullRequests.commentsFor(FOLDER, remote, COMMENTED);

    host.context.raiseEvent(AzureDevOpsNames.signInChangedEvent, signedIn);
    await Wait.until(() => expect([stacks()?.state, commit()?.state, comments()?.count]).toEqual([GitPullRequestsState.Ready, GitPullRequestsState.Ready, 2]));
    for (const fail of failures)
      fail(new WindowFailure("The runtime stopped."));
    await Promise.allSettled(host.requests.answered);
    const afterLate = [stacks(), commit(), comments()];
    host.context.raiseEvent(AzureDevOpsNames.signInChangedEvent, HostSignIn.signedOut().toJson());
    await host.requests.askedAsync(9);

    expect(afterLate).toEqual([GitPullRequestList.ready([], false), GitBranchPullRequest.of(rowOf(1, false, ""), GitPullRequestState.Merged, false, "Completed"),
      new GitCommitComments(2, false, URL)]);
    expect([host.pullRequests.stackListFor(FOLDER, remote), host.pullRequests.commitFor(FOLDER, remote, HEAD),
      host.pullRequests.commentsFor(FOLDER, remote, COMMENTED), host.requests.methods.length]).toEqual([stacks, commit, comments, 9]);
  });

  it("keeps the re-reads waiting behind the queue's limit when a commit's earlier reads fail meanwhile, and reads that commit again at the next sign-in",
    async () => {
      const host = new Host();
      const ids: readonly string[] = ["a", "b", "c", "d", "e"].map(t => t.repeat(40));
      const merged = pullRequestOf(ReferenceState.Merged, ReviewDecision.Approved, 1).toJson();
      host.requests.answer(AzureDevOpsNames.readCommitPullRequestMethod, ...ids.slice(0, 4).map(() => new BranchPullRequest(null, []).toJson()));
      const failures = [host.requests.holdFailure(AzureDevOpsNames.readCommitPullRequestMethod), host.requests.holdFailure(AzureDevOpsNames.readCommitCommentsMethod)];
      const held = ids.slice(0, 4).map(() => host.requests.hold(AzureDevOpsNames.readCommitPullRequestMethod));
      host.requests.answer(AzureDevOpsNames.readCommitPullRequestMethod, merged, ...ids.map(() => new BranchPullRequest(null, []).toJson()));
      host.requests.answer(AzureDevOpsNames.readCommitCommentsMethod, new HostCommitComments(2, false, URL).toJson(), HostCommitComments.none().toJson());
      const commits = ids.map(t => host.pullRequests.commitFor(FOLDER, remote, t));
      const comments = host.pullRequests.commentsFor(FOLDER, remote, COMMENTED);
      await host.requests.askedAsync(6);

      host.context.raiseEvent(AzureDevOpsNames.signInChangedEvent, signedIn);
      await host.requests.askedAsync(10);
      for (const fail of failures)
        fail(new WindowFailure("The runtime stopped."));
      await Wait.until(() => expect(host.context.callsOf("log")).toHaveLength(2));
      const whileWaiting = commits[4]?.();
      for (const release of held)
        release(new BranchPullRequest(null, []).toJson());
      await Wait.until(() => expect([commits[4]?.()?.state, comments()?.count]).toEqual([GitPullRequestsState.Ready, 2]));
      host.context.raiseEvent(AzureDevOpsNames.signInChangedEvent, HostSignIn.signedOut().toJson());
      await Wait.until(() => expect([commits[4]?.()?.pullRequest, comments()?.count]).toEqual([null, 0]));

      expect([whileWaiting, host.pullRequests.commitFor(FOLDER, remote, ids[4] ?? "") === commits[4],
        host.pullRequests.commentsFor(FOLDER, remote, COMMENTED) === comments, host.requests.methods.length]).toEqual([null, true, true, 18]);
    });
});
