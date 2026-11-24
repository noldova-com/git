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
import { CheckState, HostBuild, HostChanges, HostComment, HostItem, HostPerson, HostPullRequest, HostPullRequestThreads, HostReference, HostReviewer, HostThread,
  ReferenceKind, ReferenceState, ThreadStatus } from "@noldova/git.hosting.protocol";
import { describe, it } from "vitest";

import { GitHubApi } from "../../src/services/github-api.ts";
import { GitHubAvatars } from "../../src/services/github-avatars.ts";
import { GitHubReads } from "../../src/services/github-reads.ts";
import { FakeGitHub, FakeToken } from "../fixtures/fake-github.fixture.ts";

const signal: AbortSignal = new AbortController().signal;
const head = "6dcb09b5b57875f334f61aebed695e2e4193db5e";
const created = "2026-11-01T10:00:00Z";
const user = { login: "octocat", avatar_url: null, html_url: "https://github.com/octocat" };
const octocat: HostPerson = new HostPerson("octocat", null, "https://github.com/octocat");
const reference: HostReference = new HostReference("git-github", "octocat", "hello-world", 2);
const pull = { number: 2, title: "Fix the bug", state: "open", draft: false, merged_at: null, html_url: "https://github.com/octocat/hello-world/pull/2",
  user, created_at: created, closed_at: null, comments: 1, additions: 10, deletions: 3, changed_files: 2, head: { ref: "fix-bug", sha: head }, base: { ref: "main" },
  body: "Fixes #1.", commits: 3, auto_merge: null, mergeable_state: "clean", requested_reviewers: [], requested_teams: [], review_comments: 0 };
const item: HostItem = new HostItem(reference, ReferenceKind.PullRequest, ReferenceState.Open, "Fix the bug", pull.html_url, octocat, Date.parse(created), null, 1,
  new HostChanges(10, 3, 2, "fix-bug", "main", head));
const pullUrl = "https://api.github.com/repos/octocat/hello-world/pulls/2";
const reviewsUrl = "https://api.github.com/repos/octocat/hello-world/pulls/2/reviews?per_page=100";
const runsUrl = `https://api.github.com/repos/octocat/hello-world/commits/${head}/check-runs?per_page=100`;
const issueCommentsUrl = "https://api.github.com/repos/octocat/hello-world/issues/2/comments?per_page=100";
const pullCommentsUrl = "https://api.github.com/repos/octocat/hello-world/pulls/2/comments?per_page=100";
const noRuns = { total_count: 0, check_runs: [] };

function person(login: string): Readonly<Record<string, unknown>> {
  return { login, html_url: `https://github.com/${login}` };
}

function personOf(login: string): HostPerson {
  return new HostPerson(login, null, `https://github.com/${login}`);
}

function review(login: string, state: string): Readonly<Record<string, unknown>> {
  return { user: person(login), state, author_association: "NONE" };
}

function at(minute: number): string {
  return `2026-11-01T10:${String(minute).padStart(2, "0")}:00Z`;
}

function comment(id: number, minute: number, extra: Readonly<Record<string, unknown>> = {}): Readonly<Record<string, unknown>> {
  return { id, user, created_at: at(minute), body: `Comment ${String(id)}.`, ...extra };
}

function hostComment(id: number, minute: number, parent: number | null = null): HostComment {
  return new HostComment(id, parent, octocat, Date.parse(at(minute)), `Comment ${String(id)}.`);
}

function counted(comments: number, reviewComments: number): Response {
  return FakeGitHub.json({ ...pull, comments, review_comments: reviewComments });
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

describe("GitHubReads, a pull request's page", () => {
  it("reads a pull request with its author's picture, description, commits, auto-merge, conflicts, reviewers by their latest review and check runs as builds",
    async () => {
      const rig = new Rig();
      const png: Uint8Array<ArrayBuffer> = Uint8Array.from([137, 80, 78, 71]);
      const reviews = [review("monalisa", "APPROVED"), review("monalisa", "COMMENTED"), review("hubot", "APPROVED"), review("mona", "CHANGES_REQUESTED"),
        review("lisa", "APPROVED"), review("lisa", "DISMISSED"), review("ana", "COMMENTED"), { user: null, state: "APPROVED", author_association: "NONE" },
        review("octocat", "COMMENTED"), review("pat", "PENDING"), review("ana", "PENDING")];
      const runs = [
        { name: "build", status: "completed", conclusion: "success", html_url: "https://github.com/octocat/hello-world/runs/1", started_at: at(1), completed_at: at(4) },
        { name: "lint", status: "in_progress", conclusion: null, html_url: null, started_at: at(2), completed_at: at(3) },
        { name: "deploy", status: "queued", conclusion: null, html_url: null, started_at: null, completed_at: null }
      ];
      rig.github.answer(FakeGitHub.json({ ...pull, user: { ...user, avatar_url: "https://avatars.githubusercontent.com/u/583231" }, auto_merge: { merge_method: "squash" },
        mergeable_state: "dirty", requested_reviewers: [person("hubot"), person("octo")],
        requested_teams: [{ name: "Web", slug: "web", html_url: "https://github.com/orgs/octocat/teams/web" }] }), new Response(new Blob([png]), { status: 200, headers: { "Content-Type": "image/png" } }),
      FakeGitHub.json(reviews), FakeGitHub.json({ total_count: 3, check_runs: runs }));

      const read = await rig.reads.readPullRequestAsync(reference, signal);

      const avatar = `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
      assert.deepEqual(read, new HostPullRequest(new HostItem(reference, ReferenceKind.PullRequest, ReferenceState.Open, "Fix the bug", pull.html_url,
        new HostPerson("octocat", avatar, "https://github.com/octocat"), Date.parse(created), null, 1, item.changes), [
        new HostReviewer(personOf("monalisa"), 1, "Approved", false), new HostReviewer(personOf("mona"), -1, "Changes requested", false),
        new HostReviewer(personOf("lisa"), 0, "Commented", false), new HostReviewer(personOf("ana"), 0, "Commented", false),
        new HostReviewer(personOf("hubot"), 0, "Review requested", false), new HostReviewer(personOf("octo"), 0, "Review requested", false),
        new HostReviewer(new HostPerson("Web", null, "https://github.com/orgs/octocat/teams/web"), 0, "Review requested", false)
      ], [], [
        new HostBuild("build", CheckState.Succeeded, "https://github.com/octocat/hello-world/runs/1", Date.parse(at(1)), Date.parse(at(4))),
        new HostBuild("lint", CheckState.Running, null, Date.parse(at(2)), null), new HostBuild("deploy", CheckState.Queued, null, null, null)
      ], true, "Fixes #1.", 3, [], "squash", true));
      assert.deepEqual(rig.github.urls(), [pullUrl, "https://avatars.githubusercontent.com/u/583231?s=64", reviewsUrl, runsUrl]);
    });

  it("reads no auto-merge, an empty description, every page of the reviews, conflicts GitHub hasn't worked out yet as unknown, and no author once their account is gone", async () => {
    const rig = new Rig();
    const other = new Rig();
    const full = Array.from({ length: 100 }, (_, i) => review(`reviewer-${String(i)}`, "COMMENTED"));
    rig.github.answer(FakeGitHub.json({ ...pull, body: null, mergeable_state: "unknown" }), FakeGitHub.json(full), FakeGitHub.json(noRuns), FakeGitHub.json([]));
    other.github.answer(FakeGitHub.json({ ...pull, user: null }), FakeGitHub.json({}, 404), FakeGitHub.json(noRuns));

    const unknown = await rig.reads.readPullRequestAsync(reference, signal);
    const clean = await other.reads.readPullRequestAsync(reference, signal);

    assert.deepEqual([unknown?.isAutoComplete, unknown?.autoCompleteMergeType, unknown?.description, unknown?.hasConflicts, unknown?.reviewers.length,
      clean?.description, clean?.hasConflicts, clean?.reviewers, clean?.item.author], [false, null, "", null, 100, "Fixes #1.", false, [], null]);
    assert.deepEqual([rig.github.urls(), other.github.urls()], [[pullUrl, reviewsUrl, runsUrl, `${reviewsUrl}&page=2`], [pullUrl, reviewsUrl, runsUrl]]);
  });

  it("answers no pull request without asking GitHub when signed out, for another host or a name GitHub can't have, and none when GitHub can't show it",
    async () => {
      const signedOut = new Rig(null);
      const rig = new Rig();
      rig.github.answer(FakeGitHub.json({}, 404));

      const answers = [await signedOut.reads.readPullRequestAsync(reference, signal),
        await rig.reads.readPullRequestAsync(new HostReference("git-gitlab", "octocat", "hello-world", 2), signal),
        await rig.reads.readPullRequestAsync(new HostReference("git-github", "octo_cat", "hello-world", 2), signal),
        await rig.reads.readPullRequestAsync(reference, signal)];

      assert.deepEqual([answers, signedOut.github.requests.length, rig.github.urls()], [[null, null, null, null], 0, [pullUrl]]);
    });

  it("tells the sign-in when GitHub refuses its token, fails a pull request it can't read as Unavailable, and drops one read for an account that left",
    async () => {
      const rig = new Rig();
      const unreadable = new Rig();
      rig.github.answer(FakeGitHub.json({ message: "Bad credentials" }, 401));
      unreadable.github.answer(FakeGitHub.json({ ...pull, mergeable_state: undefined }), FakeGitHub.json([]), FakeGitHub.json(noRuns));
      const failures = [await rig.reads.readPullRequestAsync(reference, signal).then(() => null, codeOf),
        await unreadable.reads.readPullRequestAsync(reference, signal).then(() => null, codeOf)];
      const switched = new Rig();
      const release = switched.github.hold();
      switched.github.answer(FakeGitHub.json([]), FakeGitHub.json(noRuns));
      const reading = switched.reads.readPullRequestAsync(reference, signal);
      switched.signIn.answer("token", "gho_other");
      release(FakeGitHub.json(pull));

      assert.deepEqual([failures, rig.signIn.refused, await reading], [[FailureCode.Unauthorized, FailureCode.Unavailable], ["gho_token"], null]);
    });

  it("fails a pull request read cancelled while its reviews are read with the cancel's reason", async () => {
    const rig = new Rig();
    const stopping = new AbortController();
    rig.github.answer(FakeGitHub.json(pull));
    rig.github.hold();
    rig.github.answer(FakeGitHub.json(noRuns));

    const reading = rig.reads.readPullRequestAsync(reference, stopping.signal).then(() => null, (error: unknown) => error);
    await rig.github.askedAsync(3);
    stopping.abort(new Error("Stopped."));

    assert.equal(String(await reading), "Error: Stopped.");
  });
});

describe("GitHubReads, a pull request's comment threads", () => {
  it("reads each conversation comment as a thread and each review comment with its replies as a thread on its file and line, oldest first", async () => {
    const rig = new Rig();
    rig.github.answer(counted(4, 6), FakeGitHub.json([comment(1, 2), comment(2, 9, { user: null, body: "Gone." }), comment(3, 10, { body: null }),
      comment(4, 11, { body: " " })]), FakeGitHub.json([
      comment(10, 1, { path: "src/app.ts", line: 5, in_reply_to_id: null }),
      comment(11, 3, { path: "src/app.ts", line: 5, in_reply_to_id: 10 }),
      comment(20, 4, { path: "README.md", line: null, original_line: 7 }),
      comment(31, 5, { path: "src/old.ts", line: null, original_line: null, in_reply_to_id: 30 }),
      comment(32, 6, { path: "src/old.ts", line: null, original_line: null, in_reply_to_id: 30 }),
      comment(33, 7, { path: "src/old.ts", line: null, original_line: null, in_reply_to_id: 30, body: "" })
    ]));

    const threads = await rig.reads.readPullRequestThreadsAsync(reference, signal);

    assert.deepEqual(threads, new HostPullRequestThreads([
      new HostThread(21, ThreadStatus.None, "src/app.ts", 5, [hostComment(10, 1), hostComment(11, 3, 10)]),
      new HostThread(2, ThreadStatus.None, null, null, [hostComment(1, 2)]),
      new HostThread(41, ThreadStatus.None, "README.md", 7, [hostComment(20, 4)]),
      new HostThread(61, ThreadStatus.None, "src/old.ts", null, [hostComment(31, 5), hostComment(32, 6)]),
      new HostThread(4, ThreadStatus.None, null, null, [new HostComment(2, null, new HostPerson("ghost", null, null), Date.parse(at(9)), "Gone.")])
    ], false));
    assert.deepEqual(rig.github.urls(), [pullUrl, issueCommentsUrl, pullCommentsUrl]);
  });

  it("keeps a conversation comment's thread and a review comment's thread apart when GitHub gives both comments the same id", async () => {
    const rig = new Rig();
    rig.github.answer(counted(1, 1), FakeGitHub.json([comment(5, 1)]), FakeGitHub.json([comment(5, 2, { path: "src/app.ts", line: 3 })]));

    const threads = await rig.reads.readPullRequestThreadsAsync(reference, signal);

    assert.deepEqual([threads.threads.map(t => t.id), threads.threads.map(t => t.comments.map(u => u.id))], [[10, 11], [[5], [5]]]);
  });

  it("keeps the newest 100 of each kind past 100, starting at the page the counts put them on, and says there are older ones", async () => {
    const rig = new Rig();
    const conversation = Array.from({ length: 100 }, (_, i) => comment(i + 1, 1));
    const second = Array.from({ length: 100 }, (_, i) => comment(2000 + i, 2, { path: "src/app.ts", line: 1 }));
    const third = Array.from({ length: 50 }, (_, i) => comment(3000 + i, 4, { path: "src/app.ts", line: 1 }));
    rig.github.answer(counted(101, 250), FakeGitHub.json(conversation), FakeGitHub.json(second), FakeGitHub.json([comment(101, 3)]), FakeGitHub.json(third));

    const threads = await rig.reads.readPullRequestThreadsAsync(reference, signal);

    const ids: readonly number[] = threads.threads.map(t => t.id);
    assert.deepEqual([threads.hasMore, ids.length, ids.includes(2), ids.includes(4), ids.includes(202), ids.includes(2049 * 2 + 1), ids.includes(2050 * 2 + 1),
      ids.at(-1)], [true, 200, false, true, true, false, true, 3049 * 2 + 1]);
    assert.deepEqual(rig.github.urls(), [pullUrl, issueCommentsUrl, `${pullCommentsUrl}&page=2`, `${issueCommentsUrl}&page=2`, `${pullCommentsUrl}&page=3`]);
  });

  it("reads on past a count the page read kept a minute ago while pages come back full, so the newest comments since still arrive", async () => {
    const rig = new Rig();
    const pageOf = (page: number, count: number): Response => FakeGitHub.json(Array.from({ length: count }, (_, i) => comment((page - 1) * 100 + i + 1, page)));
    rig.github.answer(FakeGitHub.json({ ...pull, comments: 200 }), FakeGitHub.json([]), FakeGitHub.json(noRuns), pageOf(2, 100), FakeGitHub.json([]), pageOf(3, 100),
      pageOf(4, 10));

    const page = await rig.reads.readPullRequestAsync(reference, signal);
    const threads = await rig.reads.readPullRequestThreadsAsync(reference, signal);

    const ids: readonly number[] = threads.threads.map(t => t.id);
    assert.deepEqual([page?.item.comments, threads.hasMore, ids.length, ids[0], ids.at(-1)], [200, true, 100, 211 * 2, 310 * 2]);
    assert.deepEqual(rig.github.urls(), [pullUrl, reviewsUrl, runsUrl, `${issueCommentsUrl}&page=2`, pullCommentsUrl, `${issueCommentsUrl}&page=3`,
      `${issueCommentsUrl}&page=4`]);
  });

  it("answers no threads without asking GitHub when signed out or for another host, and none for a pull request GitHub can't show", async () => {
    const signedOut = new Rig(null);
    const rig = new Rig();
    rig.github.answer(FakeGitHub.json({}, 404));
    const none: HostPullRequestThreads = new HostPullRequestThreads([], false);

    const answers = [await signedOut.reads.readPullRequestThreadsAsync(reference, signal),
      await rig.reads.readPullRequestThreadsAsync(new HostReference("git-gitlab", "octocat", "hello-world", 2), signal),
      await rig.reads.readPullRequestThreadsAsync(reference, signal)];

    assert.deepEqual([answers, signedOut.github.requests.length, rig.github.urls()], [[none, none, none], 0, [pullUrl]]);
  });

  it("reads none for comment lists GitHub can't show", async () => {
    const rig = new Rig();
    rig.github.answer(counted(2, 2), FakeGitHub.json({}, 404), FakeGitHub.json({}, 404));

    assert.deepEqual(await rig.reads.readPullRequestThreadsAsync(reference, signal), new HostPullRequestThreads([], false));
  });

  it("tells the sign-in when GitHub refuses its token, fails comments it can't read as Unavailable, and drops threads read for an account that left", async () => {
    const rig = new Rig();
    const unreadable = new Rig();
    const uncounted = new Rig();
    rig.github.answer(FakeGitHub.json({ message: "Bad credentials" }, 401));
    unreadable.github.answer(counted(0, 1), FakeGitHub.json([]), FakeGitHub.json([comment(10, 1, { path: " ", line: 5 })]));
    uncounted.github.answer(FakeGitHub.json({ ...pull, review_comments: undefined }));
    const failures = [await rig.reads.readPullRequestThreadsAsync(reference, signal).then(() => null, codeOf),
      await unreadable.reads.readPullRequestThreadsAsync(reference, signal).then(() => null, codeOf),
      await uncounted.reads.readPullRequestThreadsAsync(reference, signal).then(() => null, codeOf)];
    const switched = new Rig();
    const release = switched.github.hold();
    switched.github.answer(FakeGitHub.json([]), FakeGitHub.json([]));
    const reading = switched.reads.readPullRequestThreadsAsync(reference, signal);
    switched.signIn.answer("token", null);
    release(counted(0, 0));

    assert.deepEqual([failures, rig.signIn.refused, await reading], [[FailureCode.Unauthorized, FailureCode.Unavailable, FailureCode.Unavailable], ["gho_token"],
      new HostPullRequestThreads([], false)]);
  });
});
