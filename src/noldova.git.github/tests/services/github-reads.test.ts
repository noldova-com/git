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
import { AuthorQuery, BranchPullRequest, BranchQuery, CheckState, CommitQuery, HostChanges, HostCheck, HostCommitComments, HostItem, HostPerson, HostPullRequestList, HostPullRequestRow, HostReference,
  HostReviewRequest, HostReviewRequestList, PullRequestDraft, ReferenceKind, ReferenceState, RepositoryQuery, ReviewDecision } from "@noldova/git.hosting.protocol";
import { afterEach, describe, it, vi } from "vitest";

import type { IGitHubTokens } from "../../src/interfaces/i-github-tokens.ts";
import { SignedInAccount } from "../../src/models/signed-in-account.ts";
import { GitHubApi } from "../../src/services/github-api.ts";
import { GitHubAvatars } from "../../src/services/github-avatars.ts";
import { GitHubReads } from "../../src/services/github-reads.ts";
import { FakeGitHub, FakeToken } from "../fixtures/fake-github.fixture.ts";

const signal: AbortSignal = new AbortController().signal;
const head = "6dcb09b5b57875f334f61aebed695e2e4193db5e";
const local = "7638417db6d59f3c431d3e1f261cc637155684cd";
const user = { login: "octocat", avatar_url: "https://avatars.githubusercontent.com/u/583231", html_url: "https://github.com/octocat" };
const octocat: HostPerson = new HostPerson("octocat", null, "https://github.com/octocat");
const created = "2026-11-01T10:00:00Z";
const closed = "2026-11-02T09:30:00Z";
const merged = "2026-11-03T08:15:00Z";
const issue = { number: 1, title: "Found a bug", state: "open", state_reason: null, html_url: "https://github.com/octocat/hello-world/issues/1", user,
  created_at: created, closed_at: null, comments: 2 };
const pull = { number: 2, title: "Fix the bug", state: "open", draft: false, merged_at: null, html_url: "https://github.com/octocat/hello-world/pull/2",
  user, created_at: created, closed_at: null, comments: 1, additions: 10, deletions: 3, changed_files: 2, head: { ref: "fix-bug", sha: head }, base: { ref: "main" } };
const issueReference: HostReference = new HostReference("git-github", "octocat", "hello-world", 1);
const pullReference: HostReference = new HostReference("git-github", "octocat", "hello-world", 2);
const changes: HostChanges = new HostChanges(10, 3, 2, "fix-bug", "main", head);

function pullRequest(state: ReferenceState): HostItem {
  const closedAt: number | null = state === ReferenceState.Merged ? Date.parse(merged) : state === ReferenceState.Closed ? Date.parse(closed) : null;
  return new HostItem(pullReference, ReferenceKind.PullRequest, state, "Fix the bug", pull.html_url, octocat, Date.parse(created), closedAt, 1, changes);
}

const reviewSearchUrl = "https://api.github.com/search/issues?q=is%3Apr+is%3Aopen+review-requested%3A%40me&sort=updated&order=desc&per_page=100";

function reviewItem(repository: string, number: number, title: string, createdAt: string, draft: boolean = false): Readonly<Record<string, unknown>> {
  return { number, title, html_url: `https://github.com/${repository}/pull/${number}`, draft, created_at: createdAt, user,
    repository_url: `https://api.github.com/repos/${repository}`, pull_request: { url: `https://api.github.com/repos/${repository}/pulls/${number}` } };
}

class TwoAccounts implements IGitHubTokens {
  public held: readonly string[] = ["gho_octocat", "gho_hubot"];

  public get signedIn(): readonly SignedInAccount[] {
    return [new SignedInAccount(1, "octocat", "gho_octocat"), new SignedInAccount(2, "hubot", "gho_hubot")].filter(t => this.held.includes(t.token));
  }

  public tokenForAsync(): Promise<string | null> {
    return Promise.resolve("gho_octocat");
  }

  public holds(token: string): boolean {
    return this.held.includes(token);
  }

  public refusedAsync(): Promise<void> {
    return Promise.resolve();
  }
}

function reviewSearch(items: readonly Readonly<Record<string, unknown>>[], total: number = items.length, incomplete: boolean = false): Response {
  return FakeGitHub.json({ total_count: total, incomplete_results: incomplete, items });
}

const commitCommentsUrl = `https://api.github.com/repos/octocat/hello-world/commits/${head}/comments?per_page=100`;
const pullCommentsUrl = "https://api.github.com/repos/octocat/hello-world/pulls/2/comments?per_page=100";
const commitQuery: CommitQuery = new CommitQuery("github.com", "octocat/hello-world", head);
const commitPullRequestsUrl = `https://api.github.com/repos/octocat/hello-world/commits/${head}/pulls?per_page=100`;
const mergedPull = { ...pull, state: "closed", closed_at: closed, merged_at: merged };

function associated(number: number, mergedAt: string | null, base: string): Readonly<Record<string, unknown>> {
  return { number, merged_at: mergedAt, base: { ref: base, repo: { default_branch: "main" } } };
}

function commitComment(id: number): Readonly<Record<string, unknown>> {
  return { id, html_url: `https://github.com/octocat/hello-world/commit/${head}#commitcomment-${id}`, commit_id: head, user };
}

function reviewComment(id: number, commit: string, original: string = commit): Readonly<Record<string, unknown>> {
  return { id, html_url: `https://github.com/octocat/hello-world/pull/2#discussion_r${id}`, commit_id: commit, original_commit_id: original, user };
}

function codeOf(error: unknown): string | null {
  return error instanceof MethodFailureException ? error.failure.code : null;
}

class Rig {
  public readonly github: FakeGitHub = new FakeGitHub();
  public readonly signIn: FakeToken;
  public readonly reads: GitHubReads;

  public constructor(token: string | null = "gho_token") {
    this.signIn = new FakeToken(token);
    this.reads = new GitHubReads(new GitHubApi(this.github.fetch), this.signIn, new GitHubAvatars(this.github.fetch, new FakeModuleLog()));
  }
}

describe("GitHubReads", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads an issue in each of its states, with or without its author", async () => {
    const rig = new Rig();
    rig.github.answer(FakeGitHub.json(issue), FakeGitHub.json({ ...issue, number: 3, state: "closed", state_reason: "completed", closed_at: closed }),
      FakeGitHub.json({ ...issue, number: 4, state: "closed", state_reason: "not_planned", closed_at: closed, user: null }));

    const items: (HostItem | null)[] = [];
    for (const number of [1, 3, 4])
      items.push(await rig.reads.readReferenceAsync(new HostReference("git-github", "octocat", "hello-world", number), signal));

    const item = (number: number, state: ReferenceState, author: HostPerson | null): HostItem => new HostItem(new HostReference("git-github", "octocat",
      "hello-world", number), ReferenceKind.Issue, state, "Found a bug", issue.html_url, author, Date.parse(created),
      state === ReferenceState.Open ? null : Date.parse(closed), 2, null);
    assert.deepEqual(items, [item(1, ReferenceState.Open, octocat), item(3, ReferenceState.ClosedDone, octocat), item(4, ReferenceState.ClosedNotPlanned, null)]);
    assert.deepEqual(rig.github.urls(), [1, 3, 4].map(t => `https://api.github.com/repos/octocat/hello-world/issues/${t}`));
  });

  it("reads a pull request through its issue, in each of its states", async () => {
    const marker = { ...issue, number: 2, pull_request: { url: "https://api.github.com/repos/octocat/hello-world/pulls/2" } };
    const items: (HostItem | null)[] = [];
    const urls: (readonly string[])[] = [];
    for (const answer of [pull, { ...pull, draft: true }, { ...pull, state: "closed", closed_at: closed }, { ...pull, state: "closed", closed_at: closed, merged_at: merged }]) {
      const rig = new Rig();
      rig.github.answer(FakeGitHub.json(marker), FakeGitHub.json(answer));
      items.push(await rig.reads.readReferenceAsync(pullReference, signal));
      urls.push(rig.github.urls());
    }

    assert.deepEqual(items, [ReferenceState.Open, ReferenceState.Draft, ReferenceState.Closed, ReferenceState.Merged].map(pullRequest));
    assert.deepEqual(urls[0], ["https://api.github.com/repos/octocat/hello-world/issues/2", "https://api.github.com/repos/octocat/hello-world/pulls/2"]);
  });

  it("keeps the author's profile page as GitHub gives it: a person's, a [bot] app's, an app's whose login has no [bot] suffix, or none", async () => {
    const rig = new Rig();
    const authors = [{ login: "monalisa", avatar_url: null, html_url: "https://github.com/monalisa" },
      { login: "release-helper[bot]", avatar_url: null, html_url: "https://github.com/apps/release-helper" },
      { login: "greeting-helper", avatar_url: "https://avatars.githubusercontent.com/in/15368", html_url: "https://github.com/apps/greeting-helper" },
      { login: "hubot", avatar_url: null }, { login: "ghost", avatar_url: null, html_url: null }];
    rig.github.answer(...authors.map((t, index) => FakeGitHub.json({ ...issue, number: index + 1, user: t })));

    const items: (HostItem | null)[] = [];
    for (const number of [1, 2, 3, 4, 5])
      items.push(await rig.reads.readReferenceAsync(new HostReference("git-github", "octocat", "hello-world", number), signal));

    assert.deepEqual(items.map(t => [t?.author?.login, t?.author?.url]), [["monalisa", "https://github.com/monalisa"],
      ["release-helper[bot]", "https://github.com/apps/release-helper"], ["greeting-helper", "https://github.com/apps/greeting-helper"], ["hubot", null],
      ["ghost", null]]);
  });

  it("reads an author whose profile page isn't an https address without one, rather than failing the read", async () => {
    const rig = new Rig();
    const pages = ["http://github.com/monalisa", "github.com/monalisa", "https://monalisa:secret@github.com/monalisa", ""];
    rig.github.answer(...pages.map((t, index) => FakeGitHub.json({ ...issue, number: index + 1, user: { login: "monalisa", avatar_url: null, html_url: t } })));

    const items: (HostItem | null)[] = [];
    for (const number of [1, 2, 3, 4])
      items.push(await rig.reads.readReferenceAsync(new HostReference("git-github", "octocat", "hello-world", number), signal));

    assert.deepEqual(items.map(t => [t?.title, t?.author?.login, t?.author?.url]), pages.map(() => ["Found a bug", "monalisa", null]));
  });

  it("reads the author's avatar for a shown reference without the token, keeps it for the next, and reads none for an agent's read", async () => {
    const rig = new Rig();
    const marker = { ...issue, number: 2, pull_request: { url: "https://api.github.com/repos/octocat/hello-world/pulls/2" } };
    const png: Uint8Array<ArrayBuffer> = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
    rig.github.answer(FakeGitHub.json(issue), new Response(new Blob([png]), { status: 200, headers: { "Content-Type": "image/png" } }), FakeGitHub.json(marker),
      FakeGitHub.json(pull));

    const shownIssue = await rig.reads.readShownReferenceAsync(issueReference, signal);
    const shownPull = await rig.reads.readShownReferenceAsync(pullReference, signal);
    const agentIssue = await rig.reads.readReferenceAsync(issueReference, signal);

    const avatar = `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
    assert.deepEqual([shownIssue?.author?.avatar, shownPull?.author?.avatar, agentIssue?.author?.avatar], [avatar, avatar, null]);
    assert.deepEqual(rig.github.urls(), ["https://api.github.com/repos/octocat/hello-world/issues/1", "https://avatars.githubusercontent.com/u/583231?s=64",
      "https://api.github.com/repos/octocat/hello-world/issues/2", "https://api.github.com/repos/octocat/hello-world/pulls/2"]);
    assert.deepEqual(rig.github.requests.map(t => t.header("Authorization")), ["Bearer gho_token", null, "Bearer gho_token", "Bearer gho_token"]);
    assert.ok(!JSON.stringify([shownIssue?.toJson(), shownPull?.toJson(), agentIssue?.toJson()]).includes("avatars.githubusercontent.com"));
  });

  it("reads the avatar alongside the pull request and answers without it once five seconds pass with no avatar", async () => {
    vi.useFakeTimers();
    const rig = new Rig();
    const marker = { ...issue, number: 2, pull_request: { url: "https://api.github.com/repos/octocat/hello-world/pulls/2" } };
    rig.github.answer(FakeGitHub.json(marker));
    rig.github.hold();
    rig.github.answer(FakeGitHub.json(pull));

    const reading: Promise<HostItem | null> = rig.reads.readShownReferenceAsync(pullReference, signal);
    await rig.github.askedAsync(3);
    const asked: readonly string[] = rig.github.urls();
    await vi.advanceTimersByTimeAsync(5_000);

    assert.deepEqual(await reading, pullRequest(ReferenceState.Open));
    assert.deepEqual(asked, ["https://api.github.com/repos/octocat/hello-world/issues/2", "https://avatars.githubusercontent.com/u/583231?s=64",
      "https://api.github.com/repos/octocat/hello-world/pulls/2"]);
  });

  it("fails a shown read cancelled while its avatar is read with the cancel's reason", async () => {
    const rig = new Rig();
    const marker = { ...issue, number: 2, pull_request: { url: "https://api.github.com/repos/octocat/hello-world/pulls/2" } };
    rig.github.answer(FakeGitHub.json(marker));
    rig.github.hold();
    rig.github.hold();
    rig.github.answer(FakeGitHub.json(issue));
    rig.github.hold();
    const failures: unknown[] = [];

    for (const reference of [pullReference, issueReference]) {
      const stopped = new AbortController();
      const reading: Promise<unknown> = rig.reads.readShownReferenceAsync(reference, stopped.signal).then(() => null, (error: unknown) => error);
      await rig.github.askedAsync(reference === pullReference ? 3 : 5);
      stopped.abort(new Error(`Stopped ${reference.number}.`));
      failures.push(String(await reading));
    }

    assert.deepEqual([failures, rig.github.urls().length], [["Error: Stopped 2.", "Error: Stopped 1."], 5]);
  });

  it("shows a reference without its avatar when the avatar can't be read, and reads none for an author GitHub doesn't name", async () => {
    const rig = new Rig();
    rig.github.answer(FakeGitHub.json(issue), FakeGitHub.json({}, 404), FakeGitHub.json({ ...issue, number: 3, user: null }),
      FakeGitHub.json({ ...issue, number: 4, user: { login: "ghost", avatar_url: null } }));

    const items: (HostItem | null)[] = [];
    for (const number of [1, 3, 4])
      items.push(await rig.reads.readShownReferenceAsync(new HostReference("git-github", "octocat", "hello-world", number), signal));

    assert.deepEqual(items.map(t => [t?.title, t?.author?.login ?? null, t?.author?.avatar ?? null]),
      [["Found a bug", "octocat", null], ["Found a bug", null, null], ["Found a bug", "ghost", null]]);
    assert.equal(rig.github.requests.length, 4);
  });

  it("shows a reference without its avatar when the avatar server can't be reached", async () => {
    const rig = new Rig();
    rig.github.answer(FakeGitHub.json(issue));
    rig.github.fail(new TypeError("fetch failed"));

    const shown = await rig.reads.readShownReferenceAsync(issueReference, signal);

    assert.deepEqual([shown?.title, shown?.author?.login, shown?.author?.avatar], ["Found a bug", "octocat", null]);
    assert.deepEqual(rig.github.urls(), ["https://api.github.com/repos/octocat/hello-world/issues/1", "https://avatars.githubusercontent.com/u/583231?s=64"]);
  });

  it("fails a shown read with an avatar failure that isn't the network's, rather than showing the reference without its avatar", async () => {
    const rig = new Rig();
    const unexpected = new RangeError("Unexpected.");
    rig.github.answer(FakeGitHub.json(issue));
    rig.github.fail(unexpected);

    const failure: unknown = await rig.reads.readShownReferenceAsync(issueReference, signal).then(() => null, (error: unknown) => error);

    assert.equal(failure, unexpected);
    assert.deepEqual(rig.github.urls(), ["https://api.github.com/repos/octocat/hello-world/issues/1", "https://avatars.githubusercontent.com/u/583231?s=64"]);
  });

  it("answers null without asking GitHub when signed out or for another host, and null for what GitHub can't show", async () => {
    const signedOut = new Rig(null);
    const rig = new Rig();
    rig.github.answer(FakeGitHub.json({}, 404), FakeGitHub.json({ ...issue, number: 2, pull_request: {} }), FakeGitHub.json({}, 404));

    const answers = [await signedOut.reads.readReferenceAsync(issueReference, signal),
      await rig.reads.readReferenceAsync(new HostReference("git-gitlab", "octocat", "hello-world", 1), signal),
      await rig.reads.readReferenceAsync(issueReference, signal), await rig.reads.readReferenceAsync(pullReference, signal)];

    assert.deepEqual([answers, signedOut.github.requests.length, rig.github.requests.length], [[null, null, null, null], 0, 3]);
  });

  it("tells the sign-in when GitHub refuses its token, and fails an answer it can't read as Unavailable and a cancel as it is, without signing out", async () => {
    const rig = new Rig();
    rig.github.answer(FakeGitHub.json({ message: "Bad credentials" }, 401), FakeGitHub.json({ ...issue, title: "" }), FakeGitHub.json(issue));
    const stopped = new AbortController();
    stopped.abort(new Error("Stopped."));

    const failures = [await rig.reads.readReferenceAsync(issueReference, signal).then(() => null, codeOf),
      await rig.reads.readReferenceAsync(new HostReference("git-github", "octocat", "hello-world", 5), signal).then(() => null, codeOf)];
    const cancelled: unknown = await rig.reads.readReferenceAsync(new HostReference("git-github", "octocat", "hello-world", 6), stopped.signal).then(() => null, (error: unknown) => error);

    assert.deepEqual([failures, String(cancelled), rig.signIn.refused], [[FailureCode.Unauthorized, FailureCode.Unavailable], "Error: Stopped.", ["gho_token"]]);
  });

  it("reads the branch's pull request and the checks of the pushed head, or of the local head when given, in each check state", async () => {
    const rig = new Rig();
    const runs = [
      { name: "queued", status: "queued", conclusion: null, html_url: null },
      { name: "waiting", status: "waiting", conclusion: null, html_url: null },
      { name: "running", status: "in_progress", conclusion: null, html_url: "https://github.com/octocat/hello-world/runs/1" },
      { name: "passed", status: "completed", conclusion: "success", html_url: null },
      { name: "skipped", status: "completed", conclusion: "skipped", html_url: null },
      { name: "cancelled", status: "completed", conclusion: "cancelled", html_url: null },
      { name: "failed", status: "completed", conclusion: "failure", html_url: null },
      { name: "timed out", status: "completed", conclusion: "timed_out", html_url: null }
    ];
    rig.github.answer(FakeGitHub.json([pull]), FakeGitHub.json(pull), FakeGitHub.json({ total_count: 8, check_runs: runs }), FakeGitHub.json([]),
      FakeGitHub.json({}, 404));

    const pushed = await rig.reads.readBranchPullRequestAsync(new BranchQuery("github.com", "octocat/hello-world", "fix-bug", null), signal);
    const ahead = await rig.reads.readBranchPullRequestAsync(new BranchQuery("github.com", "octocat/hello-world.git", "fix-bug", local), signal);

    const states = [CheckState.Queued, CheckState.Queued, CheckState.Running, CheckState.Succeeded, CheckState.Neutral, CheckState.Neutral, CheckState.Failed,
      CheckState.Failed];
    assert.deepEqual(pushed, new BranchPullRequest(pullRequest(ReferenceState.Open), runs.map((t, index) => new HostCheck(t.name, states[index] ?? CheckState.Neutral,
      t.html_url))));
    assert.deepEqual(ahead, new BranchPullRequest(pullRequest(ReferenceState.Open), []));
    assert.deepEqual(rig.github.urls(), [
      "https://api.github.com/repos/octocat/hello-world/pulls?head=octocat%3Afix-bug&state=all&per_page=1",
      "https://api.github.com/repos/octocat/hello-world/pulls/2",
      `https://api.github.com/repos/octocat/hello-world/commits/${head}/check-runs?per_page=100`,
      "https://api.github.com/repos/octocat/hello-world/pulls/2/reviews?per_page=100",
      `https://api.github.com/repos/octocat/hello-world/commits/${local}/check-runs?per_page=100`
    ]);
  });

  it("reads every page of the head's check runs that GitHub counts, and stops at a page that comes back empty", async () => {
    const passed = Array.from({ length: 100 }, (_, index) => ({ name: `passed ${index}`, status: "completed", conclusion: "success", html_url: null }));
    const failed = { name: "failed", status: "completed", conclusion: "failure", html_url: null };
    const paged = new Rig();
    paged.github.answer(FakeGitHub.json([pull]), FakeGitHub.json(pull), FakeGitHub.json({ total_count: 101, check_runs: passed }),
      FakeGitHub.json({ total_count: 101, check_runs: [failed] }), FakeGitHub.json([]));
    const short = new Rig();
    short.github.answer(FakeGitHub.json([pull]), FakeGitHub.json(pull), FakeGitHub.json({ total_count: 150, check_runs: passed }),
      FakeGitHub.json({ total_count: 150, check_runs: [] }), FakeGitHub.json([]));
    const query = new BranchQuery("github.com", "octocat/hello-world", "fix-bug", null);

    const answers = [await paged.reads.readBranchPullRequestAsync(query, signal), await short.reads.readBranchPullRequestAsync(query, signal)];

    assert.deepEqual(answers.map(t => [t.checks.length, t.checks.at(-1)?.state]), [[101, CheckState.Failed], [100, CheckState.Succeeded]]);
    assert.deepEqual([paged.github.urls().slice(2, 4), short.github.urls().length], [[
      `https://api.github.com/repos/octocat/hello-world/commits/${head}/check-runs?per_page=100`,
      `https://api.github.com/repos/octocat/hello-world/commits/${head}/check-runs?per_page=100&page=2`
    ], 5]);
  });

  it("reads the review decision from each owner's, member's or collaborator's latest review that approves, requests changes or was dismissed", async () => {
    const review = (login: string, state: string, association: string = "MEMBER"): object => ({ user: { login }, state, author_association: association });
    const pages: readonly (readonly object[])[] = [
      [],
      [review("hubot", "COMMENTED"), review("monalisa", "APPROVED"), review("hubot", "PENDING")],
      [review("monalisa", "CHANGES_REQUESTED"), review("hubot", "APPROVED"), review("monalisa", "COMMENTED")],
      [review("monalisa", "CHANGES_REQUESTED"), review("monalisa", "APPROVED")],
      [review("monalisa", "CHANGES_REQUESTED"), review("monalisa", "DISMISSED"), review("hubot", "APPROVED")],
      [review("monalisa", "APPROVED"), review("monalisa", "DISMISSED"), { user: null, state: "CHANGES_REQUESTED", author_association: "OWNER" }],
      [review("octocat", "APPROVED", "OWNER"), review("outsider", "CHANGES_REQUESTED", "CONTRIBUTOR")],
      [review("hubot", "APPROVED", "COLLABORATOR"), review("monalisa", "COMMENTED"), review("outsider", "APPROVED", "NONE")],
      [review("outsider", "APPROVED", "FIRST_TIME_CONTRIBUTOR")]
    ];
    const decisions: (ReviewDecision | null)[] = [];
    for (const reviews of pages) {
      const rig = new Rig();
      rig.github.answer(FakeGitHub.json([pull]), FakeGitHub.json(pull), FakeGitHub.json({ total_count: 0, check_runs: [] }), FakeGitHub.json(reviews));
      const answer = await rig.reads.readBranchPullRequestAsync(new BranchQuery("github.com", "octocat/hello-world", "fix-bug", null), signal);
      decisions.push(answer.reviewDecision);
    }

    assert.deepEqual(decisions, [ReviewDecision.Waiting, ReviewDecision.Approved, ReviewDecision.ChangesRequested, ReviewDecision.Approved,
      ReviewDecision.Approved, ReviewDecision.Waiting, ReviewDecision.Approved, ReviewDecision.Approved, ReviewDecision.Waiting]);
  });

  it("reads every page of the reviews, and takes none when GitHub has no reviews to show", async () => {
    const approved = Array.from({ length: 100 }, (_, index) => ({ user: { login: `reviewer${index}` }, state: "APPROVED", author_association: "MEMBER" }));
    const paged = new Rig();
    paged.github.answer(FakeGitHub.json([pull]), FakeGitHub.json(pull), FakeGitHub.json({ total_count: 0, check_runs: [] }), FakeGitHub.json(approved),
      FakeGitHub.json([{ user: { login: "reviewer7" }, state: "CHANGES_REQUESTED", author_association: "MEMBER" }]));
    const missing = new Rig();
    missing.github.answer(FakeGitHub.json([pull]), FakeGitHub.json(pull), FakeGitHub.json({ total_count: 0, check_runs: [] }), FakeGitHub.json({}, 404));
    const query = new BranchQuery("github.com", "octocat/hello-world", "fix-bug", null);

    const answers = [await paged.reads.readBranchPullRequestAsync(query, signal), await missing.reads.readBranchPullRequestAsync(query, signal)];

    assert.deepEqual(answers.map(t => t.reviewDecision), [ReviewDecision.ChangesRequested, ReviewDecision.Waiting]);
    assert.deepEqual(paged.github.urls().slice(3), [
      "https://api.github.com/repos/octocat/hello-world/pulls/2/reviews?per_page=100",
      "https://api.github.com/repos/octocat/hello-world/pulls/2/reviews?per_page=100&page=2"
    ]);
  });

  it("fails as Unavailable for a reviews answer it can't read", async () => {
    const failures: (string | null)[] = [];
    for (const reviews of [{ message: "x" }, [{ user: { login: "hubot" }, author_association: "MEMBER" }],
      [{ user: { login: 7 }, state: "APPROVED", author_association: "MEMBER" }], [{ user: { login: "hubot" }, state: "APPROVED" }]]) {
      const rig = new Rig();
      rig.github.answer(FakeGitHub.json([pull]), FakeGitHub.json(pull), FakeGitHub.json({ total_count: 0, check_runs: [] }), FakeGitHub.json(reviews));
      failures.push(await rig.reads.readBranchPullRequestAsync(new BranchQuery("github.com", "octocat/hello-world", "fix-bug", null), signal)
        .then(() => null, codeOf));
    }

    assert.deepEqual(failures, [FailureCode.Unavailable, FailureCode.Unavailable, FailureCode.Unavailable, FailureCode.Unavailable]);
  });

  it("fails as Unavailable for a completed check run with no conclusion, rather than guessing it failed", async () => {
    const rig = new Rig();
    rig.github.answer(FakeGitHub.json([pull]), FakeGitHub.json(pull),
      FakeGitHub.json({ total_count: 1, check_runs: [{ name: "unknown", status: "completed", conclusion: null, html_url: null }] }));

    const failure: unknown = await rig.reads.readBranchPullRequestAsync(new BranchQuery("github.com", "octocat/hello-world", "fix-bug", null), signal)
      .then(() => null, (error: unknown) => error);

    assert.equal(codeOf(failure), FailureCode.Unavailable);
  });

  it("answers no pull request when signed out, for another host or a path that isn't owner and repository, or when GitHub has none", async () => {
    const none = new BranchPullRequest(null, []);
    const signedOut = new Rig(null);
    const rig = new Rig();
    rig.github.answer(FakeGitHub.json([]), FakeGitHub.json({}, 404), FakeGitHub.json([{ number: 9 }]), FakeGitHub.json({}, 404));
    const query = (host: string, path: string, branch: string = "fix-bug"): BranchQuery => new BranchQuery(host, path, branch, null);

    const answers = [await signedOut.reads.readBranchPullRequestAsync(query("github.com", "octocat/hello-world"), signal)];
    for (const [host, path] of [["gitlab.com", "octocat/hello-world"], ["github.com", "octocat"], ["github.com", "octo.cat/hello-world"],
      ["github.com", "octo_cat/hello-world"], ["github.com", "octocat/hello-world/extra"]] as const)
      answers.push(await rig.reads.readBranchPullRequestAsync(query(host, path), signal));
    for (const branch of ["none", "hidden", "gone"])
      answers.push(await rig.reads.readBranchPullRequestAsync(query("github.com", "octocat/hello-world", branch), signal));

    assert.deepEqual(answers, Array.from({ length: 9 }, () => none));
    assert.deepEqual([signedOut.github.requests.length, rig.github.urls().slice(2)], [0, [
      "https://api.github.com/repos/octocat/hello-world/pulls?head=octocat%3Agone&state=all&per_page=1", "https://api.github.com/repos/octocat/hello-world/pulls/9"]]);
  });

  it("reads a commit author's picture from the account a no-reply email names without a token, else from the account GitHub links to the commit", async () => {
    const rig = new Rig();
    const png: Uint8Array<ArrayBuffer> = Uint8Array.from([137, 80, 78, 71]);
    const image = (): Response => new Response(new Blob([png]), { status: 200, headers: { "Content-Type": "image/png" } });
    rig.github.answer(image(), image(), FakeGitHub.json({ sha: head, author: user }), image(), FakeGitHub.json({ sha: local, author: null }));
    const read = (email: string, commit: string = head): Promise<string | null> =>
      rig.reads.readAuthorAvatarAsync(new AuthorQuery("github.com", "octocat/hello-world", email, commit), signal);

    const avatars = [await read(" 583231+OctoCat@users.noreply.github.com"), await read("monalisa@users.noreply.github.com"), await read("octocat@example.com"),
      await read("nobody@example.com", local)];

    const avatar = `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
    assert.deepEqual(avatars, [avatar, avatar, avatar, null]);
    assert.deepEqual(rig.github.urls(), ["https://avatars.githubusercontent.com/u/583231?v=4&s=64", "https://avatars.githubusercontent.com/monalisa?s=64",
      `https://api.github.com/repos/octocat/hello-world/commits/${head}`, "https://avatars.githubusercontent.com/u/583231?s=64",
      `https://api.github.com/repos/octocat/hello-world/commits/${local}`]);
    assert.deepEqual(rig.github.requests.map(t => t.header("Authorization")), [null, null, "Bearer gho_token", null, "Bearer gho_token"]);
  });

  it("reads no author picture for another host, signed out unless the email is a no-reply one, for a commit GitHub doesn't know, or once the account changed", async () => {
    const signedOut = new Rig(null);
    const other = new Rig();
    const switched = new Rig();
    const release = switched.github.hold();
    other.github.answer(FakeGitHub.json({ message: "Not Found" }, 404));
    const query = (host: string, email: string = "octocat@example.com"): AuthorQuery => new AuthorQuery(host, "octocat/hello-world", email, head);

    const reading = switched.reads.readAuthorAvatarAsync(query("github.com"), signal);
    switched.signIn.answer("token", "gho_other");
    switched.github.answer(new Response(new Blob([Uint8Array.from([1])]), { status: 200, headers: { "Content-Type": "image/png" } }));
    release(FakeGitHub.json({ sha: head, author: user }));
    const answers = [await signedOut.reads.readAuthorAvatarAsync(query("github.com"), signal), await other.reads.readAuthorAvatarAsync(query("gitlab.com"), signal),
      await other.reads.readAuthorAvatarAsync(new AuthorQuery("github.com", "octocat", "octocat@example.com", head), signal),
      await other.reads.readAuthorAvatarAsync(query("github.com"), signal), await reading];

    assert.deepEqual([answers, signedOut.github.requests.length, other.github.urls()], [[null, null, null, null, null], 0,
      [`https://api.github.com/repos/octocat/hello-world/commits/${head}`]]);
  });

  it("tells the sign-in when GitHub refuses its token for an author's picture", async () => {
    const rig = new Rig();
    rig.github.answer(FakeGitHub.json({ message: "Bad credentials" }, 401));

    await assert.rejects(rig.reads.readAuthorAvatarAsync(new AuthorQuery("github.com", "octocat/hello-world", "octocat@example.com", head), signal), MethodFailureException);
    assert.deepEqual(rig.signIn.callsOf("refusedAsync"), [["gho_token"]]);
  });

  it("reads the open pull requests, the most recently updated first, with each one's approvals, checks, head branch and base branch", async () => {
    const rig = new Rig();
    const draft = { ...pull, number: 3, title: "Try the new layout", draft: true, html_url: "https://github.com/octocat/hello-world/pull/3", head: { ref: "layout", sha: local },
      base: { ref: "fix-bug" } };
    const runs = [
      { name: "passed", status: "completed", conclusion: "success", html_url: null },
      { name: "failed", status: "completed", conclusion: "failure", html_url: null },
      { name: "running", status: "in_progress", conclusion: null, html_url: null },
      { name: "skipped", status: "completed", conclusion: "skipped", html_url: null }
    ];
    const reviews = [{ user: { login: "monalisa" }, state: "APPROVED", author_association: "MEMBER" },
      { user: { login: "hubot" }, state: "COMMENTED", author_association: "MEMBER" }];
    rig.github.answer(FakeGitHub.json([pull, draft]), FakeGitHub.json({ total_count: 4, check_runs: runs }), FakeGitHub.json(reviews),
      FakeGitHub.json({}, 404), FakeGitHub.json([]));

    const list = await rig.reads.readPullRequestsAsync(new RepositoryQuery("github.com", "octocat/hello-world.git"), signal);

    assert.deepEqual(list, new HostPullRequestList([new HostPullRequestRow(pullReference, "Fix the bug", pull.html_url, false, 1, 1, 1, 1, "fix-bug", "main"),
      new HostPullRequestRow(new HostReference("git-github", "octocat", "hello-world", 3), "Try the new layout", draft.html_url, true, 0, 0, 0, 0, "layout", "fix-bug")],
      false));
    assert.deepEqual(rig.github.urls(), [
      "https://api.github.com/repos/octocat/hello-world/pulls?state=open&sort=updated&direction=desc&per_page=21",
      `https://api.github.com/repos/octocat/hello-world/commits/${head}/check-runs?per_page=100`,
      "https://api.github.com/repos/octocat/hello-world/pulls/2/reviews?per_page=100",
      `https://api.github.com/repos/octocat/hello-world/commits/${local}/check-runs?per_page=100`,
      "https://api.github.com/repos/octocat/hello-world/pulls/3/reviews?per_page=100"
    ]);
  });

  it("reads 20 pull requests and tells there are more past them, and none for a repository GitHub doesn't show", async () => {
    const many = new Rig();
    many.github.answer(FakeGitHub.json(Array.from({ length: 21 }, (_t, index) => ({ ...pull, number: index + 1 }))),
      ...Array.from({ length: 40 }, () => FakeGitHub.json({}, 404)));
    const missing = new Rig();
    missing.github.answer(FakeGitHub.json({}, 404));
    const query = new RepositoryQuery("github.com", "octocat/hello-world");

    const lists = [await many.reads.readPullRequestsAsync(query, signal), await missing.reads.readPullRequestsAsync(query, signal)];

    assert.deepEqual(lists.map(t => [t.rows.length, t.rows.at(-1)?.reference.number, t.hasMore, t.isSignedIn]), [[20, 20, true, true], [0, undefined, false, true]]);
    assert.deepEqual([many.github.requests.length, missing.github.requests.length], [41, 1]);
  });

  it("answers signed out without asking GitHub when signed out or once the account changed, and none for another host or a path outside GitHub's names", async () => {
    const signedOut = new Rig(null);
    const rig = new Rig();
    const switched = new Rig();
    const release = switched.github.hold();

    const reading = switched.reads.readPullRequestsAsync(new RepositoryQuery("github.com", "octocat/hello-world"), signal);
    switched.signIn.answer("token", "gho_other");
    release(FakeGitHub.json([]));
    const lists = [await signedOut.reads.readPullRequestsAsync(new RepositoryQuery("github.com", "octocat/hello-world"), signal),
      await rig.reads.readPullRequestsAsync(new RepositoryQuery("gitlab.com", "octocat/hello-world"), signal),
      await rig.reads.readPullRequestsAsync(new RepositoryQuery("github.com", "octocat"), signal), await reading];

    assert.deepEqual(lists, [HostPullRequestList.signedOut(), new HostPullRequestList([], false), new HostPullRequestList([], false), HostPullRequestList.signedOut()]);
    assert.deepEqual([signedOut.github.requests.length, rig.github.requests.length, switched.github.requests.length], [0, 0, 1]);
  });

  it("tells the sign-in when GitHub refuses its token for the pull requests, and fails a row it can't read as Unavailable", async () => {
    const rig = new Rig();
    rig.github.answer(FakeGitHub.json({ message: "Bad credentials" }, 401), FakeGitHub.json([{ ...pull, title: "" }]), FakeGitHub.json({}, 404), FakeGitHub.json([]));
    const query = new RepositoryQuery("github.com", "octocat/hello-world");

    const failures = [await rig.reads.readPullRequestsAsync(query, signal).then(() => null, codeOf), await rig.reads.readPullRequestsAsync(query, signal).then(() => null, codeOf)];

    assert.deepEqual([failures, rig.signIn.refused], [[FailureCode.Unauthorized, FailureCode.Unavailable], ["gho_token"]]);
  });

  it("drops an answer that lands after the person signed out or switched accounts", async () => {
    const answers: unknown[] = [];
    for (const next of [null, "gho_other"]) {
      const rig = new Rig();
      const releaseIssue = rig.github.hold();
      const releaseBranch = rig.github.hold();
      rig.github.answer(FakeGitHub.json(pull), FakeGitHub.json({ total_count: 0, check_runs: [] }), FakeGitHub.json([]));
      const reading = rig.reads.readReferenceAsync(issueReference, signal);
      const branch = rig.reads.readBranchPullRequestAsync(new BranchQuery("github.com", "octocat/hello-world", "fix-bug", null), signal);
      rig.signIn.answer("token", next);
      releaseIssue(FakeGitHub.json(issue));
      releaseBranch(FakeGitHub.json([pull]));
      answers.push([await reading, await branch, rig.github.requests.length]);
    }

    assert.deepEqual(answers, [[null, new BranchPullRequest(null, []), 5], [null, new BranchPullRequest(null, []), 5]]);
  });

  it("merges every signed-in account's review requests for the repository, each naming its account, and drops an account that signs out meanwhile", async () => {
    const github = new FakeGitHub();
    const tokens = new TwoAccounts();
    const reads = new GitHubReads(new GitHubApi(github.fetch), tokens, new GitHubAvatars(github.fetch, new FakeModuleLog()));
    github.answer(reviewSearch([reviewItem("octocat/hello-world", 7, "Tidy the README", "2026-11-18T08:00:00Z")]),
      reviewSearch([reviewItem("octocat/hello-world", 9, "Speed up the build", "2026-11-21T10:00:00Z"), reviewItem("octocat/spoon-knife", 3, "Fork", created)], 3));
    const query = new RepositoryQuery("github.com", "octocat/hello-world");

    const merged = await reads.readReviewRequestsAsync(query, signal);
    const later = new GitHubReads(new GitHubApi(github.fetch), tokens, new GitHubAvatars(github.fetch, new FakeModuleLog()));
    github.answer(reviewSearch([reviewItem("octocat/hello-world", 7, "Tidy the README", "2026-11-18T08:00:00Z")]));
    const release = github.hold();
    const reading = later.readReviewRequestsAsync(query, signal);
    await github.askedAsync(4);
    tokens.held = ["gho_octocat"];
    release(reviewSearch([reviewItem("octocat/hello-world", 9, "Speed up the build", "2026-11-21T10:00:00Z")]));
    const afterSignOut = await reading;
    const oneLeft = await later.readReviewRequestsAsync(query, signal);
    tokens.held = [];
    const noneLeft = await later.readReviewRequestsAsync(query, signal);

    assert.deepEqual(merged, new HostReviewRequestList([
      new HostReviewRequest(new HostReference("git-github", "octocat", "hello-world", 9), "Speed up the build", "https://github.com/octocat/hello-world/pull/9", false,
        Date.parse("2026-11-21T10:00:00Z"), "hubot"),
      new HostReviewRequest(new HostReference("git-github", "octocat", "hello-world", 7), "Tidy the README", "https://github.com/octocat/hello-world/pull/7", false,
        Date.parse("2026-11-18T08:00:00Z"), "octocat")], true));
    assert.deepEqual([afterSignOut.rows.map(t => [t.reference.number, t.account]), afterSignOut.hasMore, oneLeft.rows.map(t => [t.reference.number, t.account]), noneLeft],
      [[[7, "octocat"]], false, [[7, null]], HostReviewRequestList.signedOut()]);
    assert.deepEqual(github.requests.map(t => t.header("Authorization")), ["Bearer gho_octocat", "Bearer gho_hubot", "Bearer gho_octocat", "Bearer gho_hubot"]);
  });

  it("keeps the newest rows up to the list's limit when the accounts' review requests together pass it", async () => {
    const github = new FakeGitHub();
    const reads = new GitHubReads(new GitHubApi(github.fetch), new TwoAccounts(), new GitHubAvatars(github.fetch, new FakeModuleLog()));
    const half = HostReviewRequestList.maximumRows;
    const items = (from: number): Readonly<Record<string, unknown>>[] => Array.from({ length: half }, (_, index) =>
      reviewItem("octocat/hello-world", from + index, `Change ${from + index}`, new Date(Date.parse(created) + (from + index) * 60_000).toISOString()));
    github.answer(reviewSearch(items(1)), reviewSearch(items(1 + half)));

    const list = await reads.readReviewRequestsAsync(new RepositoryQuery("github.com", "octocat/hello-world"), signal);

    assert.deepEqual([list.rows.length, list.rows[0]?.reference.number, list.rows.at(-1)?.reference.number, list.hasMore], [half, 2 * half, half + 1, true]);
  });

  it("merges the searches that answered, saying there may be more, when another account's search fails, and fails only when every search fails", async () => {
    const github = new FakeGitHub();
    const query = new RepositoryQuery("github.com", "octocat/hello-world");
    const readsOf = (): GitHubReads => new GitHubReads(new GitHubApi(github.fetch), new TwoAccounts(), new GitHubAvatars(github.fetch, new FakeModuleLog()));
    github.answer(FakeGitHub.json({ message: "Server Error" }, 500), reviewSearch([reviewItem("octocat/hello-world", 9, "Speed up the build", created)]),
      FakeGitHub.json({ message: "Server Error" }, 500), FakeGitHub.json({ message: "Server Error" }, 502));

    const partial = await readsOf().readReviewRequestsAsync(query, signal);
    const failed = await readsOf().readReviewRequestsAsync(query, signal).catch((error: unknown) => error);

    assert.deepEqual([partial.rows.map(t => [t.reference.number, t.account]), partial.hasMore], [[[9, "hubot"]], true]);
    assert.ok(failed instanceof MethodFailureException);
    assert.deepEqual([failed.failure.code, failed.failure.message], [FailureCode.Unavailable, "GitHub refused the request (500)."]);
  });

  it("passes on a search failure that isn't GitHub's, even when another account's search answered", async () => {
    const github = new FakeGitHub();
    const unexpected = new RangeError("Unexpected.");
    github.fail(unexpected);
    github.answer(reviewSearch([]));
    const reads = new GitHubReads(new GitHubApi(github.fetch), new TwoAccounts(), new GitHubAvatars(github.fetch, new FakeModuleLog()));

    await assert.rejects(reads.readReviewRequestsAsync(new RepositoryQuery("github.com", "octocat/hello-world"), signal), unexpected);
  });

  it("reads each repository with the token chosen for it, naming the repository by its host and path", async () => {
    const rig = new Rig();
    rig.signIn.choose("github.com", "octocat/hello-world", new SignedInAccount(2, "hubot", "gho_hubot"));
    rig.github.answer(...Array.from({ length: 12 }, () => FakeGitHub.json({ message: "Not Found" }, 404)));
    const repository = new RepositoryQuery("github.com", "octocat/hello-world");

    await rig.reads.readPullRequestsAsync(repository, signal);
    await rig.reads.readBranchPullRequestAsync(new BranchQuery("github.com", "octocat/hello-world", "fix-bug", head), signal);
    await rig.reads.readCommitPullRequestAsync(commitQuery, signal);
    await rig.reads.readCommitCommentsAsync(commitQuery, signal);
    await rig.reads.readReferenceAsync(issueReference, signal);
    await rig.reads.readPullRequestAsync(pullReference, signal);
    await rig.reads.readPullRequestThreadsAsync(pullReference, signal);
    await rig.reads.readAuthorAvatarAsync(new AuthorQuery("github.com", "octocat/hello-world", "mona@example.com", head), signal);
    const created = await rig.reads.createPullRequestAsync(new PullRequestDraft("github.com", "octocat/hello-world", "fix-bug", "main", "Fix the bug", "", false), signal)
      .catch((error: unknown) => error);

    assert.ok(created instanceof MethodFailureException);
    assert.deepEqual([...new Set(rig.signIn.asked)], ["github.com octocat/hello-world"]);
    assert.deepEqual([...new Set(rig.github.requests.map(t => t.header("Authorization")))], ["Bearer gho_hubot"]);
    assert.ok(rig.github.requests.length >= 9);
  });

  it("opens a pull request with the token it is given, and fails as signed out when no account holds it any more", async () => {
    const rig = new Rig();
    const draftOf = new PullRequestDraft("github.com", "octocat/hello-world", "fix-bug", "main", "Fix the bug", "", false);

    const failed = await rig.reads.createPullRequestAsync(draftOf, signal, "gho_gone").catch((error: unknown) => error);

    assert.ok(failed instanceof MethodFailureException);
    assert.deepEqual([failed.failure.code, rig.github.requests.length], [FailureCode.Unauthorized, 0]);
  });

  it("searches the account's review requests once and shares them out by repository, ignoring case, the newest first", async () => {
    const rig = new Rig();
    rig.github.answer(reviewSearch([reviewItem("octocat/hello-world", 7, "Tidy the README", "2026-11-18T08:00:00Z"),
      reviewItem("noldova-com/desktop", 533, "Sign in with a passkey", "2026-11-20T09:00:00Z", true),
      reviewItem("octocat/Hello-World", 9, "Speed up the build", "2026-11-21T10:00:00Z"), { ...reviewItem("octocat/hello-world", 8, "Elsewhere", created),
        repository_url: "https://example.com/repos/octocat/hello-world" }]));

    const lists = [await rig.reads.readReviewRequestsAsync(new RepositoryQuery("github.com", "OctoCat/hello-world.git"), signal),
      await rig.reads.readReviewRequestsAsync(new RepositoryQuery("github.com", "noldova-com/desktop"), signal),
      await rig.reads.readReviewRequestsAsync(new RepositoryQuery("github.com", "octocat/spoon-knife"), signal)];

    assert.deepEqual(lists, [
      new HostReviewRequestList([new HostReviewRequest(new HostReference("git-github", "octocat", "Hello-World", 9), "Speed up the build",
        "https://github.com/octocat/Hello-World/pull/9", false, Date.parse("2026-11-21T10:00:00Z")),
      new HostReviewRequest(new HostReference("git-github", "octocat", "hello-world", 7), "Tidy the README", "https://github.com/octocat/hello-world/pull/7", false,
        Date.parse("2026-11-18T08:00:00Z"))], false),
      new HostReviewRequestList([new HostReviewRequest(new HostReference("git-github", "noldova-com", "desktop", 533), "Sign in with a passkey",
        "https://github.com/noldova-com/desktop/pull/533", true, Date.parse("2026-11-20T09:00:00Z"))], false),
      new HostReviewRequestList([], false)]);
    assert.deepEqual(rig.github.urls(), [reviewSearchUrl]);
  });

  it("marks every repository's list as having more when the account's search was cut or incomplete, and reads an item without a draft flag as ready",
    async () => {
      const cut = new Rig();
      const undrafted = Object.fromEntries(Object.entries(reviewItem("octocat/hello-world", 7, "Tidy the README", created)).filter(([t]) => t !== "draft"));
      cut.github.answer(reviewSearch([undrafted], 101));
      const incomplete = new Rig();
      incomplete.github.answer(reviewSearch([], 0, true));
      const missing = new Rig();
      missing.github.answer(FakeGitHub.json({}, 404));
      const query = new RepositoryQuery("github.com", "octocat/hello-world");

      const lists = [await cut.reads.readReviewRequestsAsync(query, signal), await incomplete.reads.readReviewRequestsAsync(query, signal),
        await missing.reads.readReviewRequestsAsync(query, signal)];

      assert.deepEqual(lists, [new HostReviewRequestList([new HostReviewRequest(new HostReference("git-github", "octocat", "hello-world", 7), "Tidy the README",
        "https://github.com/octocat/hello-world/pull/7", false, Date.parse(created))], true), new HostReviewRequestList([], true), new HostReviewRequestList([], false)]);
    });

  it("shares one search among reads that start together, and holds its answer or its failure for a minute before searching again", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-11-23T12:00:00Z"));
    const rig = new Rig();
    const release = rig.github.hold();
    rig.github.answer(FakeGitHub.json({ message: "API rate limit exceeded" }, 403, { "X-RateLimit-Remaining": "0" }),
      reviewSearch([reviewItem("octocat/hello-world", 7, "Tidy the README", created)]));
    const query = new RepositoryQuery("github.com", "octocat/hello-world");

    const together = [rig.reads.readReviewRequestsAsync(query, signal), rig.reads.readReviewRequestsAsync(new RepositoryQuery("github.com", "octocat/spoon-knife"), signal)];
    release(reviewSearch([]));
    const first = await Promise.all(together);
    vi.setSystemTime(Date.parse("2026-11-23T12:00:59Z"));
    const held = await rig.reads.readReviewRequestsAsync(query, signal);
    vi.setSystemTime(Date.parse("2026-11-23T12:01:00Z"));
    const limited = await rig.reads.readReviewRequestsAsync(query, signal).then(() => null, codeOf);
    vi.setSystemTime(Date.parse("2026-11-23T12:01:30Z"));
    const stillLimited = await rig.reads.readReviewRequestsAsync(query, signal).then(() => null, codeOf);
    vi.setSystemTime(Date.parse("2026-11-23T12:02:00Z"));
    const again = await rig.reads.readReviewRequestsAsync(query, signal);

    assert.deepEqual([first, held, limited, stillLimited, again.rows.map(t => t.reference.number)], [[new HostReviewRequestList([], false),
      new HostReviewRequestList([], false)], new HostReviewRequestList([], false), FailureCode.Unavailable, FailureCode.Unavailable, [7]]);
    assert.deepEqual(rig.github.urls(), [reviewSearchUrl, reviewSearchUrl, reviewSearchUrl]);
  });

  it("answers signed out without searching when signed out or once the account changed, none for another host, and searches anew for a new account",
    async () => {
      const signedOut = new Rig(null);
      const rig = new Rig();
      const release = rig.github.hold();
      rig.github.answer(reviewSearch([reviewItem("octocat/hello-world", 7, "Tidy the README", created)]));
      const query = new RepositoryQuery("github.com", "octocat/hello-world");

      const reading = rig.reads.readReviewRequestsAsync(query, signal);
      rig.signIn.answer("token", "gho_other");
      release(reviewSearch([]));
      const lists = [await signedOut.reads.readReviewRequestsAsync(query, signal), await rig.reads.readReviewRequestsAsync(new RepositoryQuery("gitlab.com",
        "octocat/hello-world"), signal), await rig.reads.readReviewRequestsAsync(new RepositoryQuery("github.com", "octocat"), signal), await reading,
      await rig.reads.readReviewRequestsAsync(query, signal)];

      assert.deepEqual(lists.map(t => [t.rows.length, t.isSignedIn]), [[0, false], [0, true], [0, true], [0, false], [1, true]]);
      assert.deepEqual([signedOut.github.requests.length, rig.github.requests.map(t => t.header("Authorization"))], [0, ["Bearer gho_token", "Bearer gho_other"]]);
    });

  it("tells the sign-in when GitHub refuses its token for the search, and fails an answer it can't read as Unavailable", async () => {
    const refused = new Rig();
    refused.github.answer(FakeGitHub.json({ message: "Bad credentials" }, 401));
    const unreadable = new Rig();
    unreadable.github.answer(reviewSearch([reviewItem("octocat/hello-world", 7, "", created)]));
    const query = new RepositoryQuery("github.com", "octocat/hello-world");

    const failures = [await refused.reads.readReviewRequestsAsync(query, signal).then(() => null, codeOf),
      await unreadable.reads.readReviewRequestsAsync(query, signal).then(() => null, codeOf)];

    assert.deepEqual([failures, refused.signIn.refused], [[FailureCode.Unauthorized, FailureCode.Unavailable], ["gho_token"]]);
  });

  it("counts the commit's own comments and the review comments made on it in the pull request that brought it in, opening the first one", async () => {
    const rig = new Rig();
    rig.github.answer(FakeGitHub.json([commitComment(1), commitComment(2)]), FakeGitHub.json([associated(2, null, "main")]),
      FakeGitHub.json([reviewComment(10, head), reviewComment(11, local, head), reviewComment(12, local), { ...reviewComment(13, head), commit_id: null }]));
    const reviewsOnly = new Rig();
    reviewsOnly.github.answer(FakeGitHub.json([]), FakeGitHub.json([associated(2, null, "main")]), FakeGitHub.json([reviewComment(12, local), reviewComment(10, head)]));

    const answers = [await rig.reads.readCommitCommentsAsync(commitQuery, signal), await reviewsOnly.reads.readCommitCommentsAsync(commitQuery, signal)];

    assert.deepEqual(answers, [new HostCommitComments(5, false, `https://github.com/octocat/hello-world/commit/${head}#commitcomment-1`),
      new HostCommitComments(1, false, "https://github.com/octocat/hello-world/pull/2#discussion_r10")]);
    assert.deepEqual(rig.github.urls(), [commitCommentsUrl, commitPullRequestsUrl, pullCommentsUrl]);
  });

  it("counts the review comments in the pull request the card shows, merged into the default branch, not one merged elsewhere and listed first", async () => {
    const rig = new Rig();
    rig.github.answer(FakeGitHub.json([]), FakeGitHub.json([associated(8, merged, "release"), associated(7, null, "main"), associated(2, merged, "main")]),
      FakeGitHub.json([reviewComment(10, head)]));

    const answer = await rig.reads.readCommitCommentsAsync(commitQuery, signal);

    assert.deepEqual([answer, rig.github.urls()], [new HostCommitComments(1, false, "https://github.com/octocat/hello-world/pull/2#discussion_r10"),
      [commitCommentsUrl, commitPullRequestsUrl, pullCommentsUrl]]);
  });

  it("caps the count past 100 or when a page was full, reads the commit's own alone with no pull request, and answers none with nothing to count", async () => {
    const full = new Rig();
    full.github.answer(FakeGitHub.json(Array.from({ length: 100 }, (_t, i) => commitComment(i + 1))), FakeGitHub.json([associated(2, null, "main")]),
      FakeGitHub.json([reviewComment(500, head)]));
    const fullReviews = new Rig();
    fullReviews.github.answer(FakeGitHub.json([]), FakeGitHub.json([associated(2, null, "main")]),
      FakeGitHub.json(Array.from({ length: 100 }, (_t, i) => reviewComment(i + 1, i < 2 ? head : local))));
    const over = new Rig();
    over.github.answer(FakeGitHub.json(Array.from({ length: 60 }, (_t, i) => commitComment(i + 1))), FakeGitHub.json([associated(2, null, "main")]),
      FakeGitHub.json(Array.from({ length: 60 }, (_t, i) => reviewComment(i + 101, head))));
    const exact = new Rig();
    exact.github.answer(FakeGitHub.json(Array.from({ length: 50 }, (_t, i) => commitComment(i + 1))), FakeGitHub.json([associated(2, null, "main")]),
      FakeGitHub.json(Array.from({ length: 50 }, (_t, i) => reviewComment(i + 101, head))));
    const unpulled = new Rig();
    unpulled.github.answer(FakeGitHub.json([commitComment(1)]), FakeGitHub.json([]));
    const missing = new Rig();
    missing.github.answer(FakeGitHub.json({}, 404), FakeGitHub.json({}, 404));
    const gone = new Rig();
    gone.github.answer(FakeGitHub.json([]), FakeGitHub.json([associated(2, null, "main")]), FakeGitHub.json({}, 404));

    const answers = [await full.reads.readCommitCommentsAsync(commitQuery, signal), await fullReviews.reads.readCommitCommentsAsync(commitQuery, signal),
      await over.reads.readCommitCommentsAsync(commitQuery, signal), await exact.reads.readCommitCommentsAsync(commitQuery, signal),
      await unpulled.reads.readCommitCommentsAsync(commitQuery, signal), await missing.reads.readCommitCommentsAsync(commitQuery, signal),
      await gone.reads.readCommitCommentsAsync(commitQuery, signal)];

    assert.deepEqual(answers.map(t => [t.count, t.isCapped]), [[100, true], [2, true], [100, true], [100, false], [1, false], [0, false], [0, false]]);
    assert.deepEqual([unpulled.github.urls(), missing.github.urls()], [[commitCommentsUrl, commitPullRequestsUrl], [commitCommentsUrl, commitPullRequestsUrl]]);
  });

  it("keeps the comment's page only when it is an https page on github.com with no user name or password, and answers none otherwise", async () => {
    const pages = ["https://example.com/octocat/hello-world/commit/1", "http://github.com/octocat/hello-world/commit/1",
      "https://kim:secret@github.com/octocat/hello-world/commit/1", "https://github.com.example.com/octocat/hello-world/commit/1", "not an address",
      "https://GitHub.com/octocat/hello-world/commit/1"];
    const answers: HostCommitComments[] = [];

    for (const page of pages) {
      const rig = new Rig();
      rig.github.answer(FakeGitHub.json([{ ...commitComment(1), html_url: page }]), FakeGitHub.json([]));
      answers.push(await rig.reads.readCommitCommentsAsync(commitQuery, signal));
    }

    assert.deepEqual(answers, [...Array.from({ length: 5 }, () => HostCommitComments.none()),
      new HostCommitComments(1, false, "https://github.com/octocat/hello-world/commit/1")]);
  });

  it("answers none without asking GitHub when signed out, for another host or a path outside GitHub's names, and once the account changed", async () => {
    const signedOut = new Rig(null);
    const rig = new Rig();
    const release = rig.github.hold();
    rig.github.answer(FakeGitHub.json([]));

    const reading = rig.reads.readCommitCommentsAsync(commitQuery, signal);
    rig.signIn.answer("token", "gho_other");
    release(FakeGitHub.json([commitComment(1)]));
    const answers = [await signedOut.reads.readCommitCommentsAsync(commitQuery, signal),
      await rig.reads.readCommitCommentsAsync(new CommitQuery("gitlab.com", "octocat/hello-world", head), signal),
      await rig.reads.readCommitCommentsAsync(new CommitQuery("github.com", "octocat", head), signal), await reading];

    assert.deepEqual(answers, Array.from({ length: 4 }, () => HostCommitComments.none()));
    assert.deepEqual([signedOut.github.requests.length, rig.github.urls()], [0, [commitCommentsUrl, commitPullRequestsUrl]]);
  });

  it("tells the sign-in when GitHub refuses its token for the comments, and fails a comment it can't read as Unavailable", async () => {
    const refused = new Rig();
    refused.github.answer(FakeGitHub.json({ message: "Bad credentials" }, 401), FakeGitHub.json([]));
    const unreadable = new Rig();
    unreadable.github.answer(FakeGitHub.json([{ id: 1 }]), FakeGitHub.json([]));

    const failures = [await refused.reads.readCommitCommentsAsync(commitQuery, signal).then(() => null, codeOf),
      await unreadable.reads.readCommitCommentsAsync(commitQuery, signal).then(() => null, codeOf)];

    assert.deepEqual([failures, refused.signIn.refused], [[FailureCode.Unauthorized, FailureCode.Unavailable], ["gho_token"]]);
  });

  it("reads the pull request merged into the default branch that brought the commit in, ahead of an open one and one merged elsewhere", async () => {
    const rig = new Rig();
    const runs = [{ name: "passed", status: "completed", conclusion: "success", html_url: null }];
    rig.github.answer(FakeGitHub.json([associated(7, null, "main"), associated(8, merged, "release"), associated(2, merged, "main")]), FakeGitHub.json(mergedPull),
      FakeGitHub.json({ total_count: 1, check_runs: runs }), FakeGitHub.json([]));

    const answer = await rig.reads.readCommitPullRequestAsync(commitQuery, signal);

    assert.deepEqual(answer, new BranchPullRequest(pullRequest(ReferenceState.Merged), [new HostCheck("passed", CheckState.Succeeded, null)]));
    assert.deepEqual(rig.github.urls(), [commitPullRequestsUrl, "https://api.github.com/repos/octocat/hello-world/pulls/2",
      `https://api.github.com/repos/octocat/hello-world/commits/${head}/check-runs?per_page=100`, "https://api.github.com/repos/octocat/hello-world/pulls/2/reviews?per_page=100"]);
  });

  it("reads the first pull request GitHub lists for the commit when none merged into the default branch, and none when no pull request holds it", async () => {
    const listed = new Rig();
    listed.github.answer(FakeGitHub.json([associated(2, null, "main"), associated(8, merged, "release")]), FakeGitHub.json(pull),
      FakeGitHub.json({ total_count: 0, check_runs: [] }), FakeGitHub.json([]));
    const empty = new Rig();
    empty.github.answer(FakeGitHub.json([]));
    const missing = new Rig();
    missing.github.answer(FakeGitHub.json({}, 404));
    const gone = new Rig();
    gone.github.answer(FakeGitHub.json([associated(2, merged, "main")]), FakeGitHub.json({}, 404));

    const answers = [await listed.reads.readCommitPullRequestAsync(commitQuery, signal), await empty.reads.readCommitPullRequestAsync(commitQuery, signal),
      await missing.reads.readCommitPullRequestAsync(commitQuery, signal), await gone.reads.readCommitPullRequestAsync(commitQuery, signal)];

    assert.deepEqual(answers, [new BranchPullRequest(pullRequest(ReferenceState.Open), []), ...Array.from({ length: 3 }, () => new BranchPullRequest(null, []))]);
    assert.deepEqual([listed.github.urls().slice(0, 2), empty.github.urls(), missing.github.urls()],
      [[commitPullRequestsUrl, "https://api.github.com/repos/octocat/hello-world/pulls/2"], [commitPullRequestsUrl], [commitPullRequestsUrl]]);
  });

  it("answers no commit pull request without asking GitHub when signed out, for another host or a path outside GitHub's names, and once the account changed",
    async () => {
      const signedOut = new Rig(null);
      const rig = new Rig();
      const release = rig.github.hold();

      const reading = rig.reads.readCommitPullRequestAsync(commitQuery, signal);
      rig.signIn.answer("token", "gho_other");
      release(FakeGitHub.json([]));
      const answers = [await signedOut.reads.readCommitPullRequestAsync(commitQuery, signal),
        await rig.reads.readCommitPullRequestAsync(new CommitQuery("gitlab.com", "octocat/hello-world", head), signal),
        await rig.reads.readCommitPullRequestAsync(new CommitQuery("github.com", "octocat", head), signal), await reading];

      assert.deepEqual(answers, Array.from({ length: 4 }, () => new BranchPullRequest(null, [])));
      assert.deepEqual([signedOut.github.requests.length, rig.github.urls()], [0, [commitPullRequestsUrl]]);
    });

  it("tells the sign-in when GitHub refuses its token for the commit's pull request, and fails one it can't read as Unavailable", async () => {
    const refused = new Rig();
    refused.github.answer(FakeGitHub.json({ message: "Bad credentials" }, 401));
    const unreadable = new Rig();
    unreadable.github.answer(FakeGitHub.json([{ number: 2, merged_at: merged, base: { ref: "main" } }]));

    const failures = [await refused.reads.readCommitPullRequestAsync(commitQuery, signal).then(() => null, codeOf),
      await unreadable.reads.readCommitPullRequestAsync(commitQuery, signal).then(() => null, codeOf)];

    assert.deepEqual([failures, refused.signIn.refused], [[FailureCode.Unauthorized, FailureCode.Unavailable], ["gho_token"]]);
  });

  it("refuses an owner or repository outside GitHub's names without asking GitHub", async () => {
    const rig = new Rig();

    const answers = [await rig.reads.readReferenceAsync(new HostReference("git-github", "octo.cat", "hello-world", 1), signal),
      await rig.reads.readReferenceAsync(new HostReference("git-github", "octocat/tools", "hello-world", 1), signal),
      await rig.reads.createPullRequestAsync(new PullRequestDraft("github.com", "octo_cat/hello-world", "fix-bug", "main", "Fix the bug", "", false), signal)
        .then(() => null, codeOf)];

    assert.deepEqual([answers, rig.github.requests.length], [[null, null, FailureCode.InvalidParams], 0]);
  });

  it("tells the sign-in when GitHub refuses its token for a branch's pull request", async () => {
    const rig = new Rig();
    rig.github.answer(FakeGitHub.json({ message: "Bad credentials" }, 401));

    const failure = await rig.reads.readBranchPullRequestAsync(new BranchQuery("github.com", "octocat/hello-world", "fix-bug", null), signal).then(() => null, codeOf);

    assert.deepEqual([failure, rig.signIn.refused], [FailureCode.Unauthorized, ["gho_token"]]);
  });

  it("opens a pull request with the draft's fields and answers it as GitHub made it", async () => {
    const rig = new Rig();
    rig.github.answer(FakeGitHub.json({ ...pull, draft: true }, 201));

    const made = await rig.reads.createPullRequestAsync(new PullRequestDraft("github.com", "octocat/hello-world", "fix-bug", "main", "Fix the bug", "Fixes #1.", true),
      signal);

    assert.deepEqual(made, pullRequest(ReferenceState.Draft));
    assert.deepEqual([rig.github.urls(), rig.github.requests[0]?.body], [["https://api.github.com/repos/octocat/hello-world/pulls"],
      { title: "Fix the bug", body: "Fixes #1.", head: "fix-bug", base: "main", draft: true }]);
  });

  it("refuses to open a pull request when signed out or off github.com, and tells the sign-in when GitHub refuses its token", async () => {
    const draft = (host: string, path: string): PullRequestDraft => new PullRequestDraft(host, path, "fix-bug", "main", "Fix the bug", "", false);
    const signedOut = new Rig(null);
    const rig = new Rig();
    rig.github.answer(FakeGitHub.json({ message: "Bad credentials" }, 401));

    const failures = [await signedOut.reads.createPullRequestAsync(draft("github.com", "octocat/hello-world"), signal).then(() => null, codeOf),
      await rig.reads.createPullRequestAsync(draft("gitlab.com", "octocat/hello-world"), signal).then(() => null, codeOf),
      await rig.reads.createPullRequestAsync(draft("github.com", "octocat"), signal).then(() => null, codeOf),
      await rig.reads.createPullRequestAsync(draft("github.com", "octocat/hello-world"), signal).then(() => null, codeOf)];

    assert.deepEqual([failures, rig.signIn.refused, signedOut.github.requests.length, rig.github.requests.length],
      [[FailureCode.Unauthorized, FailureCode.InvalidParams, FailureCode.InvalidParams, FailureCode.Unauthorized], ["gho_token"], 0, 1]);
  });
});
