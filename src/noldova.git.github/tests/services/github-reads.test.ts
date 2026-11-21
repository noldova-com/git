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
import { BranchPullRequest, BranchQuery, CheckState, HostChanges, HostCheck, HostItem, HostPerson, HostReference, PullRequestDraft, ReferenceKind,
  ReferenceState, ReviewDecision } from "@noldova/git.hosting.protocol";
import { afterEach, describe, it, vi } from "vitest";

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
