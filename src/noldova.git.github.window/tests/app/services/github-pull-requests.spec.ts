/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Signal } from "@angular/core";
import "@noldova/context.core";
import { FailureCode } from "@noldova/desktop.protocol";
import { RuntimeRequestException } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { GitHubNames } from "@noldova/git.github.protocol";
import { BranchPullRequest, CheckState, CommitQuery, DeviceCode, HostAccount, HostAccountEntry, HostAccountList, HostChanges, HostCheck, HostCommitComments, HostItem, HostPullRequestList,
  HostPullRequestRow, HostReference, HostReviewRequest, HostReviewRequestList, HostSignIn, ReferenceKind, ReferenceState, RepositoryQuery,
  ReviewDecision } from "@noldova/git.hosting.protocol";
import { GitRemote, RemoteTransport } from "@noldova/git.protocol";
import { GitBranchPullRequest, GitCommitComments, GitPullRequestList, GitPullRequestRow, GitPullRequestState, GitPullRequestsState } from "@noldova/git.window";
import { describe, expect, it } from "vitest";

import { GitHubPullRequests } from "../../../src/app/services/github-pull-requests.ts";
import { RequestAnswers } from "../../fixtures/request-answers.fixture.ts";
import { UnhandledRejections } from "../../fixtures/unhandled-rejections.fixture.ts";
import { Wait } from "../../fixtures/wait.fixture.ts";
import { WindowFailure } from "../../fixtures/window-failure.fixture.ts";

const FOLDER: string = "/work/site";
const COMMENTED: string = "6dcb09b5b57875f334f61aebed695e2e4193db5e";
const UNCOMMENTED: string = "7638417db6d59f3c431d3e1f261cc637155684cd";
const UNANSWERED: string = "GitHub didn't answer. Try again to read this repository's pull requests.";
const URL: string = "https://github.com/octocat/site/pull/752";
const remote: GitRemote = new GitRemote("origin", "github.com", "octocat/site", RemoteTransport.Https);
const other: GitRemote = new GitRemote("origin", "github.com", "octocat/docs", RemoteTransport.Https);
const row: HostPullRequestRow = new HostPullRequestRow(new HostReference("git-github", "octocat", "site", 752), "Export notes as Markdown files",
  URL, true, 1, 2, 0, 1, "export-notes", "main");
const shown: GitPullRequestRow = new GitPullRequestRow("octocat/site#752", "#752", "Export notes as Markdown files", URL, true, 1, 2, 0, 1, "export-notes", "main");
const request: HostReviewRequest = new HostReviewRequest(new HostReference("git-github", "octocat", "site", 533), "Sign in with a passkey",
  "https://github.com/octocat/site/pull/533", true, Date.parse("2026-11-20T09:00:00Z"));
const asked: GitPullRequestRow = new GitPullRequestRow("octocat/site#533", "#533", "Sign in with a passkey", "https://github.com/octocat/site/pull/533", true, 0,
  0, 0, 0, "");

const COMMIT_UNANSWERED: string = "GitHub didn't answer. Its pull request reads again when the commit opens again.";
const reference: HostReference = new HostReference("git-github", "octocat", "site", 752);
const checks: readonly HostCheck[] = [new HostCheck("build", CheckState.Succeeded, null), new HostCheck("lint", CheckState.Failed, null),
  new HostCheck("test", CheckState.Running, null), new HostCheck("deploy", CheckState.Queued, null), new HostCheck("docs", CheckState.Neutral, null)];

function pullRequestOf(state: ReferenceState, decision: ReviewDecision = ReviewDecision.Waiting, approvals: number | null = null): BranchPullRequest {
  const isOpen: boolean = state === ReferenceState.Open || state === ReferenceState.Draft;
  return new BranchPullRequest(new HostItem(reference, ReferenceKind.PullRequest, state, "Export notes as Markdown files", URL, null, 1_800_000_000_000,
    isOpen ? null : 1_800_000_100_000, 0, HostChanges.uncounted("export-notes", "main", COMMENTED)), checks, decision, approvals);
}

function cardRowOf(approvals: number, isDraft: boolean = false): GitPullRequestRow {
  return new GitPullRequestRow("octocat/site#752", "#752", "Export notes as Markdown files", URL, isDraft, approvals, 1, 1, 2, "", "main");
}

function untilAsync(answer: Signal<GitBranchPullRequest | null>, state: GitPullRequestsState): Promise<void> {
  return Wait.until(() => {
    if (answer()?.state !== state)
      throw new Error(`The answer isn't ${state} yet.`);
  });
}

class Host {
  public readonly context: FakeWindowPartContext = new FakeWindowPartContext();
  public readonly requests: RequestAnswers = new RequestAnswers(this.context);
  public readonly pullRequests: GitHubPullRequests = new GitHubPullRequests(this.context);

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

describe("GitHubPullRequests", () => {
  it("claims github.com remotes only, names the host and the accounts page, leaves opening a row to the browser, and has no list before it reads", () => {
    const host = new Host();
    const claimed = ["github.com", "gitlab.com", "dev.azure.com", null]
      .map(t => host.pullRequests.claims(new GitRemote("origin", t, "octocat/site", RemoteTransport.Https)));

    expect([claimed, host.pullRequests.hostName, host.pullRequests.signInPage, host.pullRequests.listFor(FOLDER, remote)(), "open" in host.pullRequests])
      .toEqual([[true, false, false, false], "GitHub", "git.accounts", null, false]);
  });

  it("opens a new pull request on the repository's compare page, each branch's segments escaped, and has none for a remote without a path", () => {
    const host = new Host();

    expect([host.pullRequests.newPullRequestUrl(remote, "feature/a b#1", "release/2.0"),
      host.pullRequests.newPullRequestUrl(new GitRemote("origin", "github.com", null, RemoteTransport.Https), "feature", "main")])
      .toEqual(["https://github.com/octocat/site/compare/release/2.0...feature/a%20b%231?expand=1", null]);
  });

  it("reads the remote's pull requests and lists each, keyed by its reference and labelled by its number", async () => {
    const host = new Host();
    host.requests.answer(GitHubNames.readPullRequestsMethod, new HostPullRequestList([row], false).toJson());

    const list = await host.readAsync(remote, GitPullRequestsState.Ready);

    expect([host.requests.methods, host.requests.payloads]).toEqual([[GitHubNames.readPullRequestsMethod],
      [new RepositoryQuery("github.com", "octocat/site").toJson()]]);
    expect(list()).toEqual(GitPullRequestList.ready([shown]));
    expect(host.pullRequests.listFor(FOLDER, remote)).toBe(list);
  });

  it("keeps the rows it showed while it reads again, and gives another remote its own list", async () => {
    const host = new Host();
    host.requests.answer(GitHubNames.readPullRequestsMethod, new HostPullRequestList([row], false).toJson());
    const release = host.requests.hold(GitHubNames.readPullRequestsMethod);
    const list = await host.readAsync(remote, GitPullRequestsState.Ready);

    host.pullRequests.refresh(FOLDER, remote);
    await host.requests.askedAsync(2);
    const reading = list();
    release(new HostPullRequestList([], false).toJson());
    await Host.untilAsync(list, GitPullRequestsState.Ready);

    expect([reading, list(), host.pullRequests.listFor(FOLDER, other)()]).toEqual([GitPullRequestList.reading([shown]), GitPullRequestList.ready([]), null]);
  });

  it("says nobody is signed in when GitHub reads none for that reason", async () => {
    const host = new Host();
    host.requests.answer(GitHubNames.readPullRequestsMethod, HostPullRequestList.signedOut().toJson());

    const list = await host.readAsync(remote, GitPullRequestsState.SignedOut);

    expect(list()).toEqual(GitPullRequestList.signedOut());
  });

  it("reads every list, review list, commit pull request and comment count again when someone signs in or out, but not while a sign-in waits or once it stops", async () => {
    const host = new Host();
    host.requests.answer(GitHubNames.readPullRequestsMethod, HostPullRequestList.signedOut().toJson(), new HostPullRequestList([row], false).toJson(),
      HostPullRequestList.signedOut().toJson());
    host.requests.answer(GitHubNames.readReviewRequestsMethod, HostReviewRequestList.signedOut().toJson(), new HostReviewRequestList([request], false).toJson(),
      HostReviewRequestList.signedOut().toJson());
    host.requests.answer(GitHubNames.readCommitCommentsMethod, HostCommitComments.none().toJson(), new HostCommitComments(2, false, URL).toJson(),
      HostCommitComments.none().toJson());
    host.requests.answer(GitHubNames.readCommitPullRequestMethod, new BranchPullRequest(null, []).toJson(), pullRequestOf(ReferenceState.Merged).toJson(),
      new BranchPullRequest(null, []).toJson());
    const list = await host.readAsync(remote, GitPullRequestsState.SignedOut);
    const reviews = host.pullRequests.reviewsFor(remote);
    host.pullRequests.refreshReviews(remote);
    await Host.untilAsync(reviews, GitPullRequestsState.SignedOut);
    const comments = host.pullRequests.commentsFor(FOLDER, remote, COMMENTED);
    const commit = host.pullRequests.commitFor(FOLDER, remote, COMMENTED);
    await host.requests.askedAsync(4);

    host.context.raiseEvent(GitHubNames.signInChangedEvent, HostSignIn.waiting(new DeviceCode("WDJB-MJHT", "https://github.com/login/device", 1_800_000_000_000)).toJson());
    const whileWaiting = host.requests.methods.length;
    host.context.raiseEvent(GitHubNames.signInChangedEvent, HostSignIn.signedIn(new HostAccount("octocat", null, null, ["repo"])).toJson());
    await Host.untilAsync(list, GitPullRequestsState.Ready);
    await Host.untilAsync(reviews, GitPullRequestsState.Ready);
    await Wait.until(() => expect(comments()?.count).toBe(2));
    await Wait.until(() => expect(commit()?.pullRequestState).toBe(GitPullRequestState.Merged));
    const signedIn = [list(), reviews(), comments(), commit()];
    host.context.raiseEvent(GitHubNames.signInChangedEvent, HostSignIn.signedOut().toJson());
    await Host.untilAsync(list, GitPullRequestsState.SignedOut);
    await Host.untilAsync(reviews, GitPullRequestsState.SignedOut);
    await Wait.until(() => expect(comments()?.count).toBe(0));
    await Wait.until(() => expect(commit()?.pullRequest).toBeNull());
    host.pullRequests.stop();
    host.context.raiseEvent(GitHubNames.signInChangedEvent, HostSignIn.signedOut().toJson());

    expect([whileWaiting, host.requests.methods.length, host.context.activeCallsOf("onEvent")]).toEqual([4, 12, []]);
    expect(signedIn).toEqual([GitPullRequestList.ready([shown]), GitPullRequestList.ready([asked], false), new GitCommitComments(2, false, URL),
      GitBranchPullRequest.of(cardRowOf(0), GitPullRequestState.Merged, false)]);
  });

  it("keeps a sign-in's comment count when an earlier read answers or fails after it, and reads that commit again at the next sign-in", async () => {
    const host = new Host();
    const releaseFirst = host.requests.hold(GitHubNames.readCommitCommentsMethod);
    const failFirst = host.requests.holdFailure(GitHubNames.readCommitCommentsMethod);
    host.requests.answer(GitHubNames.readCommitCommentsMethod, new HostCommitComments(2, false, URL).toJson(), HostCommitComments.none().toJson(),
      new HostCommitComments(3, false, URL).toJson(), HostCommitComments.none().toJson());
    const commented = host.pullRequests.commentsFor(FOLDER, remote, COMMENTED);
    const uncommented = host.pullRequests.commentsFor(FOLDER, remote, UNCOMMENTED);

    host.context.raiseEvent(GitHubNames.signInChangedEvent, HostSignIn.signedIn(new HostAccount("octocat", null, null, ["repo"])).toJson());
    await Wait.until(() => expect([commented()?.count, uncommented()?.count]).toEqual([2, 0]));
    releaseFirst(new HostCommitComments(5, false, URL).toJson());
    failFirst(new WindowFailure("The runtime stopped."));
    await Promise.allSettled(host.requests.answered);
    const afterLate = [commented()?.count, uncommented()?.count];
    host.context.raiseEvent(GitHubNames.signInChangedEvent, HostSignIn.signedOut().toJson());
    await Wait.until(() => expect(commented()?.count).toBe(3));
    await host.requests.askedAsync(6);

    expect([afterLate, uncommented()?.count, host.requests.methods.length]).toEqual([[2, 0], 0, 6]);
  });

  it("keeps a re-read waiting behind the queue's limit when the commit's earlier read fails meanwhile, and reads that commit again at the next sign-in", async () => {
    const host = new Host();
    const ids: readonly string[] = ["a", "b", "c", "d", "e"].map(t => t.repeat(40));
    host.requests.answer(GitHubNames.readCommitCommentsMethod, ...ids.slice(0, 4).map(() => HostCommitComments.none().toJson()));
    const failFirst = host.requests.holdFailure(GitHubNames.readCommitCommentsMethod);
    const held = ids.slice(0, 4).map(() => host.requests.hold(GitHubNames.readCommitCommentsMethod));
    host.requests.answer(GitHubNames.readCommitCommentsMethod, new HostCommitComments(2, false, URL).toJson(), ...ids.map(() => HostCommitComments.none().toJson()));
    const counts = ids.map(t => host.pullRequests.commentsFor(FOLDER, remote, t));
    await host.requests.askedAsync(5);

    host.context.raiseEvent(GitHubNames.signInChangedEvent, HostSignIn.signedIn(new HostAccount("octocat", null, null, ["repo"])).toJson());
    await host.requests.askedAsync(9);
    failFirst(new WindowFailure("The runtime stopped."));
    await Wait.until(() => expect(host.context.callsOf("log")).toHaveLength(1));
    for (const release of held)
      release(HostCommitComments.none().toJson());
    await Wait.until(() => expect(counts[4]?.()?.count).toBe(2));
    host.context.raiseEvent(GitHubNames.signInChangedEvent, HostSignIn.signedOut().toJson());
    await Wait.until(() => expect(counts[4]?.()?.count).toBe(0));

    expect([host.pullRequests.commentsFor(FOLDER, remote, ids[4] ?? "") === counts[4], host.requests.methods.length]).toEqual([true, 15]);
  });

  it("keeps when a used-up rate limit resets from a failed pull request read", async () => {
    const host = new Host();
    host.requests.fail(GitHubNames.readPullRequestsMethod, new RuntimeRequestException(FailureCode.Unavailable, "GitHub's rate limit is used up.",
      { rateLimitedUntil: 1_800_003_600_000 }));

    const list = await host.readAsync(remote, GitPullRequestsState.Failed);

    expect([list()?.failure, list()?.limitedUntil]).toEqual(["GitHub's rate limit is used up.", 1_800_003_600_000]);
  });

  it("shows the runtime's message for a failed read, says plainly that the window failed, and logs both", async () => {
    const host = new Host();
    host.requests.fail(GitHubNames.readPullRequestsMethod, new RuntimeRequestException(FailureCode.Unavailable, "The repository isn't reachable."));
    host.requests.fail(GitHubNames.readPullRequestsMethod, new WindowFailure("The runtime stopped."));

    const list = await host.readAsync(remote, GitPullRequestsState.Failed);
    const runtime = list();
    host.pullRequests.refresh(FOLDER, remote);
    await Wait.until(() => {
      if (list()?.failure !== UNANSWERED)
        throw new Error("The second read hasn't failed yet.");
    });

    expect([runtime, list()]).toEqual([GitPullRequestList.failed("The repository isn't reachable."),
      GitPullRequestList.failed(UNANSWERED)]);
    expect(host.context.callsOf("log")).toHaveLength(2);
  });

  it("drops an answer or failure a newer read overtook", async () => {
    const host = new Host();
    const release = host.requests.hold(GitHubNames.readPullRequestsMethod);
    const reject = host.requests.holdFailure(GitHubNames.readPullRequestsMethod);
    host.requests.answer(GitHubNames.readPullRequestsMethod, new HostPullRequestList([row], false).toJson());
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
    const pathless = new GitRemote("origin", "github.com", null, RemoteTransport.Https);
    const hostless = new GitRemote("origin", null, null, RemoteTransport.Https);

    host.pullRequests.refresh(FOLDER, pathless);
    host.pullRequests.refresh(FOLDER, hostless);

    expect([host.requests.methods, host.pullRequests.listFor(FOLDER, pathless)(), host.pullRequests.listFor(FOLDER, hostless)()]).toEqual([[], null, null]);
  });

  it("reads the lists again when an added account signs in, out or leaves, but not for the first account, a waiting sign-in or an unchanged list", async () => {
    const host = new Host();
    const kim = HostSignIn.signedIn(new HostAccount("kim", null, null, ["repo"]));
    const waiting = HostSignIn.waiting(new DeviceCode("WDJB-MJHT", "https://github.com/login/device", 1_800_000_000_000));
    const listOf = (...entries: [number, HostSignIn][]): HostAccountList => new HostAccountList(entries.map(([id, t]) => new HostAccountEntry(id, t)));
    host.requests.answer(GitHubNames.readPullRequestsMethod, ...Array.from({ length: 4 }, () => HostPullRequestList.signedOut().toJson()));
    await host.readAsync(remote, GitPullRequestsState.SignedOut);
    const reads = (): number => host.requests.methods.length;
    const counts: number[] = [];

    for (const list of [listOf([1, kim]), listOf([1, HostSignIn.signedOut()]), listOf([1, kim], [2, waiting]), listOf([1, kim], [2, waiting]), listOf([1, kim], [2, kim]),
      listOf([1, kim], [2, kim]), listOf([1, kim], [2, HostSignIn.signedOut()]), listOf([1, kim])]) {
      host.context.raiseEvent(GitHubNames.accountsChangedEvent, list.toJson());
      await Promise.allSettled(host.requests.answered);
      counts.push(reads());
    }
    host.pullRequests.stop();

    expect(counts).toEqual([1, 1, 1, 1, 2, 2, 3, 4]);
    expect(host.context.activeCallsOf("onEvent")).toEqual([]);
  });

  it("keeps the account each review request was listed for on its row", async () => {
    const host = new Host();
    host.requests.answer(GitHubNames.readReviewRequestsMethod, new HostReviewRequestList([new HostReviewRequest(request.reference, request.title, request.url,
      request.isDraft, request.createdAt, "kim")], false).toJson());
    const reviews = host.pullRequests.reviewsFor(remote);

    host.pullRequests.refreshReviews(remote);
    await Host.untilAsync(reviews, GitPullRequestsState.Ready);

    expect([reviews()?.rows.map(t => t.account), asked.account]).toEqual([["kim"], null]);
  });

  it("reads the remote's review requests into a list of its own, keyed by the remote, with no counts or branch, and says when the search was cut", async () => {
    const host = new Host();
    host.requests.answer(GitHubNames.readReviewRequestsMethod, new HostReviewRequestList([request], true).toJson());
    const reviews = host.pullRequests.reviewsFor(remote);
    const before = reviews();

    host.pullRequests.refreshReviews(remote);
    await Host.untilAsync(reviews, GitPullRequestsState.Ready);

    expect([before, reviews(), host.pullRequests.reviewsFor(remote) === reviews, host.pullRequests.reviewsFor(other)(), host.pullRequests.listFor(FOLDER, remote)()])
      .toEqual([null, GitPullRequestList.ready([asked], true), true, null, null]);
    expect([host.requests.methods, host.requests.payloads]).toEqual([[GitHubNames.readReviewRequestsMethod], [new RepositoryQuery("github.com", "octocat/site").toJson()]]);
  });

  it("keeps the review requests it showed and when a used-up rate limit resets after a failed read, logging it, and says when nobody is signed in", async () => {
    const host = new Host();
    host.requests.answer(GitHubNames.readReviewRequestsMethod, new HostReviewRequestList([request], false).toJson());
    const release = host.requests.hold(GitHubNames.readReviewRequestsMethod);
    host.requests.fail(GitHubNames.readReviewRequestsMethod, new RuntimeRequestException(FailureCode.Unavailable, "GitHub's rate limit resets at 12:01.",
      { rateLimitedUntil: 1_800_003_600_000 }));
    host.requests.fail(GitHubNames.readReviewRequestsMethod, new WindowFailure("The runtime stopped."));
    host.requests.answer(GitHubNames.readReviewRequestsMethod, HostReviewRequestList.signedOut().toJson());
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
      GitPullRequestList.failedBy(new RuntimeRequestException(FailureCode.Unavailable, "GitHub's rate limit resets at 12:01.", { rateLimitedUntil: 1_800_003_600_000 }), UNANSWERED,
        [asked]), GitPullRequestList.failed(UNANSWERED, [asked]), GitPullRequestList.signedOut()]);
    expect(host.context.callsOf("log").map(t => String(t[0]))).toEqual([
      "The GitHub module's git-github.readReviewRequests request failed: RuntimeRequestException: GitHub's rate limit resets at 12:01.",
      "The GitHub module's git-github.readReviewRequests request failed: WindowFailure: The runtime stopped."]);
  });

  it("drops a review answer or failure a newer read overtook, reads nothing for a remote with no host or path, and passes on a failure that isn't the window's",
    async () => {
      const host = new Host();
      const release = host.requests.hold(GitHubNames.readReviewRequestsMethod);
      const reject = host.requests.holdFailure(GitHubNames.readReviewRequestsMethod);
      host.requests.answer(GitHubNames.readReviewRequestsMethod, new HostReviewRequestList([request], false).toJson());
      const unexpected = new TypeError("Unexpected.");
      host.requests.fail(GitHubNames.readReviewRequestsMethod, unexpected);
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
      host.pullRequests.refreshReviews(new GitRemote("origin", "github.com", null, RemoteTransport.Https));
      host.pullRequests.refreshReviews(new GitRemote("origin", null, null, RemoteTransport.Https));
      const rejected = UnhandledRejections.nextAsync();
      host.pullRequests.refreshReviews(remote);

      expect([overtaken, await rejected, host.requests.methods.length]).toEqual([GitPullRequestList.ready([asked]), unexpected, 4]);
    });

  it("reads a commit's review comments once for each remote and commit, and gives another commit its own read", async () => {
    const host = new Host();
    host.requests.answer(GitHubNames.readCommitCommentsMethod, new HostCommitComments(3, true, "https://github.com/octocat/site/pull/752#discussion_r7").toJson());
    host.requests.answer(GitHubNames.readCommitCommentsMethod, HostCommitComments.none().toJson());
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

    expect([before, comments(), again === comments, otherCommit()]).toEqual([null, new GitCommitComments(3, true, "https://github.com/octocat/site/pull/752#discussion_r7"), true,
      new GitCommitComments(0, false, null)]);
    expect([host.requests.methods, host.requests.payloads]).toEqual([[GitHubNames.readCommitCommentsMethod, GitHubNames.readCommitCommentsMethod],
      [new CommitQuery("github.com", "octocat/site", COMMENTED).toJson(), new CommitQuery("github.com", "octocat/site", UNCOMMENTED).toJson()]]);
  });

  it("logs a failed comments read and forgets it so the next ask reads again, reads nothing for a remote with no host or path, and passes on a failure that isn't the window's",
    async () => {
      const host = new Host();
      host.requests.fail(GitHubNames.readCommitCommentsMethod, new RuntimeRequestException(FailureCode.Unavailable, "GitHub refused the request (503)."));
      host.requests.answer(GitHubNames.readCommitCommentsMethod, new HostCommitComments(2, false, "https://github.com/octocat/site/pull/752#discussion_r7").toJson());
      const unexpected = new TypeError("Unexpected.");
      host.requests.fail(GitHubNames.readCommitCommentsMethod, unexpected);

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
      const pathless = host.pullRequests.commentsFor(FOLDER, new GitRemote("origin", "github.com", null, RemoteTransport.Https), COMMENTED)();
      const rejected = UnhandledRejections.nextAsync();
      host.pullRequests.commentsFor(FOLDER, other, COMMENTED);

      expect([failed(), retried === failed, retried(), hostless, pathless, await rejected, host.requests.methods.length]).toEqual([null, false,
        new GitCommitComments(2, false, "https://github.com/octocat/site/pull/752#discussion_r7"), null, null, unexpected, 3]);
      expect(host.context.callsOf("log").map(t => String(t[0]))).toEqual([
        "The GitHub module's git-github.readCommitComments request failed: RuntimeRequestException: GitHub refused the request (503)."]);
    });

  it("reads a commit's pull request once for each remote and commit as its card's row, labelled by its number with no head branch, and none for a commit "
    + "no pull request brought in", async () => {
    const host = new Host();
    host.requests.answer(GitHubNames.readCommitPullRequestMethod, pullRequestOf(ReferenceState.Merged, ReviewDecision.Approved, 1).toJson(),
      pullRequestOf(ReferenceState.Open).toJson(), pullRequestOf(ReferenceState.Draft).toJson(), pullRequestOf(ReferenceState.Open, ReviewDecision.Approved).toJson(),
      new BranchPullRequest(null, []).toJson());
    const ids: readonly string[] = ["a", "b", "c", "d", "e"].map(t => t.repeat(40));

    const answers = ids.map(t => host.pullRequests.commitFor(FOLDER, remote, t));
    for (const answer of answers)
      await untilAsync(answer, GitPullRequestsState.Ready);

    expect(answers.map(t => t())).toEqual([GitBranchPullRequest.of(cardRowOf(1), GitPullRequestState.Merged, false),
      GitBranchPullRequest.of(cardRowOf(0), GitPullRequestState.Open, true), GitBranchPullRequest.of(cardRowOf(0, true), GitPullRequestState.Draft, false),
      GitBranchPullRequest.of(cardRowOf(0), GitPullRequestState.Open, false), GitBranchPullRequest.none(0, 0, 0)]);
    expect([host.pullRequests.commitFor(FOLDER, remote, ids[0] ?? "") === answers[0], host.requests.methods.length, host.requests.payloads[0]])
      .toEqual([true, 5, new CommitQuery("github.com", "octocat/site", "a".repeat(40)).toJson()]);
  });

  it("answers a commit's failed read as failed with the runtime's message or that GitHub didn't answer, logs it and keeps no failure, so the commit reads "
    + "again when it opens again, reads nothing for a remote with no host or path, and passes on a failure that isn't the window's", async () => {
    const host = new Host();
    host.requests.fail(GitHubNames.readCommitPullRequestMethod, new RuntimeRequestException(FailureCode.Unavailable, "GitHub refused the request (503)."));
    host.requests.fail(GitHubNames.readCommitPullRequestMethod, new WindowFailure("The runtime stopped."));
    host.requests.answer(GitHubNames.readCommitPullRequestMethod, pullRequestOf(ReferenceState.Merged).toJson());
    const unexpected = new TypeError("Unexpected.");
    host.requests.fail(GitHubNames.readCommitPullRequestMethod, unexpected);

    const refused = host.pullRequests.commitFor(FOLDER, remote, COMMENTED);
    await untilAsync(refused, GitPullRequestsState.Failed);
    const unanswered = host.pullRequests.commitFor(FOLDER, remote, COMMENTED);
    await untilAsync(unanswered, GitPullRequestsState.Failed);
    const reopened = host.pullRequests.commitFor(FOLDER, remote, COMMENTED);
    await untilAsync(reopened, GitPullRequestsState.Ready);
    const hostless = host.pullRequests.commitFor(FOLDER, new GitRemote("origin", null, null, RemoteTransport.Https), COMMENTED)();
    const pathless = host.pullRequests.commitFor(FOLDER, new GitRemote("origin", "github.com", null, RemoteTransport.Https), COMMENTED)();
    const rejected = UnhandledRejections.nextAsync();
    host.pullRequests.commitFor(FOLDER, other, COMMENTED);

    expect([refused(), unanswered(), reopened(), hostless, pathless, await rejected, host.requests.methods.length]).toEqual([
      GitBranchPullRequest.failed("GitHub refused the request (503)."), GitBranchPullRequest.failed(COMMIT_UNANSWERED),
      GitBranchPullRequest.of(cardRowOf(0), GitPullRequestState.Merged, false), null, null, unexpected, 4]);
    expect(host.context.callsOf("log").map(t => String(t[0]))).toEqual([
      "The GitHub module's git-github.readCommitPullRequest request failed: RuntimeRequestException: GitHub refused the request (503).",
      "The GitHub module's git-github.readCommitPullRequest request failed: WindowFailure: The runtime stopped."]);
  });

  it("keeps a sign-in's commit pull request when an earlier read answers or fails after it, and reads that commit again at the next sign-in", async () => {
    const host = new Host();
    const releaseFirst = host.requests.hold(GitHubNames.readCommitPullRequestMethod);
    const failFirst = host.requests.holdFailure(GitHubNames.readCommitPullRequestMethod);
    host.requests.answer(GitHubNames.readCommitPullRequestMethod, pullRequestOf(ReferenceState.Merged).toJson(), new BranchPullRequest(null, []).toJson(),
      pullRequestOf(ReferenceState.Open).toJson(), new BranchPullRequest(null, []).toJson());
    const merged = host.pullRequests.commitFor(FOLDER, remote, COMMENTED);
    const unpulled = host.pullRequests.commitFor(FOLDER, remote, UNCOMMENTED);

    host.context.raiseEvent(GitHubNames.signInChangedEvent, HostSignIn.signedIn(new HostAccount("octocat", null, null, ["repo"])).toJson());
    await untilAsync(merged, GitPullRequestsState.Ready);
    await untilAsync(unpulled, GitPullRequestsState.Ready);
    releaseFirst(pullRequestOf(ReferenceState.Closed).toJson());
    failFirst(new WindowFailure("The runtime stopped."));
    await Promise.allSettled(host.requests.answered);
    const afterLate = [merged(), unpulled()];
    host.context.raiseEvent(GitHubNames.signInChangedEvent, HostSignIn.signedOut().toJson());
    await Wait.until(() => expect(merged()?.pullRequestState).toBe(GitPullRequestState.Open));
    await host.requests.askedAsync(6);

    expect([afterLate, unpulled(), host.pullRequests.commitFor(FOLDER, remote, UNCOMMENTED) === unpulled, host.requests.methods.length]).toEqual([
      [GitBranchPullRequest.of(cardRowOf(0), GitPullRequestState.Merged, false), GitBranchPullRequest.none(0, 0, 0)], GitBranchPullRequest.none(0, 0, 0), true, 6]);
  });

  it("keeps a commit pull request's re-read waiting behind the queue's limit when the commit's earlier read fails meanwhile, and reads it again at the next sign-in",
    async () => {
      const host = new Host();
      const ids: readonly string[] = ["a", "b", "c", "d", "e"].map(t => t.repeat(40));
      host.requests.answer(GitHubNames.readCommitPullRequestMethod, ...ids.slice(0, 4).map(() => new BranchPullRequest(null, []).toJson()));
      const failFirst = host.requests.holdFailure(GitHubNames.readCommitPullRequestMethod);
      const held = ids.slice(0, 4).map(() => host.requests.hold(GitHubNames.readCommitPullRequestMethod));
      host.requests.answer(GitHubNames.readCommitPullRequestMethod, pullRequestOf(ReferenceState.Merged).toJson(),
        ...ids.map(() => new BranchPullRequest(null, []).toJson()));
      const commits = ids.map(t => host.pullRequests.commitFor(FOLDER, remote, t));
      await host.requests.askedAsync(5);

      host.context.raiseEvent(GitHubNames.signInChangedEvent, HostSignIn.signedIn(new HostAccount("octocat", null, null, ["repo"])).toJson());
      await host.requests.askedAsync(9);
      failFirst(new WindowFailure("The runtime stopped."));
      await Wait.until(() => expect(host.context.callsOf("log")).toHaveLength(1));
      const whileWaiting = commits[4]?.();
      for (const release of held)
        release(new BranchPullRequest(null, []).toJson());
      await Wait.until(() => expect(commits[4]?.()?.pullRequestState).toBe(GitPullRequestState.Merged));
      host.context.raiseEvent(GitHubNames.signInChangedEvent, HostSignIn.signedOut().toJson());
      await Wait.until(() => expect(commits[4]?.()?.pullRequest).toBeNull());

      expect([whileWaiting, host.pullRequests.commitFor(FOLDER, remote, ids[4] ?? "") === commits[4], host.requests.methods.length]).toEqual([null, true, 15]);
    });

  it("passes on a failure that isn't the window's", async () => {
    const host = new Host();
    const unexpected = new TypeError("Unexpected.");
    host.requests.fail(GitHubNames.readPullRequestsMethod, unexpected);
    const rejected = UnhandledRejections.nextAsync();

    host.pullRequests.refresh(FOLDER, remote);

    expect(await rejected).toBe(unexpected);
    expect(host.context.callsOf("log")).toEqual([]);
  });
});
