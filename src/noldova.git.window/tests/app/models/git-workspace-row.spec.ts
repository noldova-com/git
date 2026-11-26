/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import "@noldova/context.core";
import { ConflictKind, FileState, type GitStatus, type StatusEntry, StatusUpstream } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { GitPullRequestState } from "../../../src/app/enums/git-pull-request-state.ts";
import { GitPullRequestsState } from "../../../src/app/enums/git-pull-requests-state.ts";
import { GitWorkspaceView } from "../../../src/app/enums/git-workspace-view.ts";
import { GitBranchPullRequest } from "../../../src/app/models/git-branch-pull-request.ts";
import { GitPullRequestList } from "../../../src/app/models/git-pull-request-list.ts";
import { GitPullRequestRow } from "../../../src/app/models/git-pull-request-row.ts";
import { GitRepositorySummary } from "../../../src/app/models/git-repository-summary.ts";
import { GitWorkspaceRow } from "../../../src/app/models/git-workspace-row.ts";
import { Resources } from "../../../src/resources.ts";
import { GitFixtures } from "../../fixtures/git-fixtures.fixture.ts";

describe("GitWorkspaceRow", () => {
  const folder: string = "/work/site";
  const modified = (path: string): StatusEntry => GitFixtures.entry(path, FileState.Modified, FileState.Unmodified);
  const summaryOf = (status: GitStatus | null, isFetching: boolean = false, failure: string | null = null): GitRepositorySummary =>
    new GitRepositorySummary(folder, status, isFetching, failure);
  const texts = (summary: GitRepositorySummary | null): readonly string[] => {
    const row: GitWorkspaceRow = new GitWorkspaceRow(folder, signal(summary), signal(undefined), signal(false));
    return [row.branch(), row.sync(), row.changes()];
  };

  it("shows nothing until a read shows the repository, and that a fetch is going", () => {
    expect([texts(null), texts(summaryOf(null)), texts(summaryOf(null, true))]).toEqual([["", "", ""], ["", "", ""], ["", "", "Fetching…"]]);
  });

  it("shows the branch, how far it is from its upstream, and how many files changed", () => {
    const upstream = (ahead: number, behind: number): StatusUpstream => new StatusUpstream("origin/main", ahead, behind, false);

    expect(texts(summaryOf(GitFixtures.status([modified("a.ts")], upstream(3, 0), { branch: "feature/graph" })))).toEqual(["feature/graph", "↑3", "1 file"]);
    expect(texts(summaryOf(GitFixtures.status([modified("a.ts"), modified("b.ts")], upstream(1, 2), { branch: "main" })))).toEqual(["main", "↑1 ↓2", "2 files"]);
    expect(texts(summaryOf(GitFixtures.status([], upstream(0, 4), { branch: "main" })))).toEqual(["main", "↓4", "Clean"]);
    expect(texts(summaryOf(GitFixtures.status([], upstream(0, 0), { branch: "main" })))).toEqual(["main", "Up to date", "Clean"]);
  });

  it("says when there's no upstream, it's gone, the head is detached or there are no commits yet", () => {
    const head: string = "abcdef1234567890abcdef1234567890abcdef12";

    expect(texts(summaryOf(GitFixtures.status([], null, { branch: "main" })))[1]).toBe("No upstream");
    expect(texts(summaryOf(GitFixtures.status([], new StatusUpstream("origin/gone", 0, 0, true), { branch: "main" })))[1]).toBe("Upstream gone");
    expect(texts(summaryOf(GitFixtures.status([], null, { branch: null, head })))[0]).toBe("Detached at abcdef1");
    expect(texts(summaryOf(GitFixtures.status([], null, { branch: null, head: null })))[0]).toBe("No commits yet");
  });

  it("counts conflicts ahead of files, marks a count cut short, and shows a fetch over the last read", () => {
    const conflicted = (path: string): StatusEntry =>
      GitFixtures.entry(path, FileState.Unmodified, FileState.Unmodified, null, ConflictKind.BothModified);
    const status: GitStatus = GitFixtures.status([modified("a.ts")], null, { branch: "main", truncated: true });

    expect(texts(summaryOf(GitFixtures.status([conflicted("a.ts")], null, { branch: "main" })))[2]).toBe("1 conflict");
    expect(texts(summaryOf(GitFixtures.status([conflicted("a.ts"), conflicted("b.ts")], null, { branch: "main" })))[2]).toBe("2 conflicts");
    expect(texts(summaryOf(status))[2]).toBe("1+ files");
    expect(texts(summaryOf(GitFixtures.status([], null, { branch: "main", truncated: true })))[2]).toBe("Changes");
    expect(texts(summaryOf(status, true))[2]).toBe("Fetching…");
  });

  it("names the row by its folder, and carries a failure and whether there are conflicts", () => {
    const failed: GitWorkspaceRow = new GitWorkspaceRow(folder, signal(summaryOf(null, false, "Not a repository.")), signal(undefined), signal(false));
    const empty: GitWorkspaceRow = new GitWorkspaceRow(folder, signal(null), signal(undefined), signal(false));
    const conflicted: GitWorkspaceRow = new GitWorkspaceRow(folder, signal(summaryOf(GitFixtures.status([
      GitFixtures.entry("a.ts", FileState.Unmodified, FileState.Unmodified, null, ConflictKind.BothModified)
    ], null, { branch: "main" }))), signal(undefined), signal(false));

    expect([failed.name, failed.failure(), failed.hasConflicts()]).toEqual(["site", "Not a repository.", false]);
    expect([empty.failure(), empty.hasConflicts(), conflicted.hasConflicts()]).toEqual([null, false, true]);
  });

  it("says how long ago the repository fetched, or that it never has, once a read shows it", () => {
    const now: Date = new Date("2026-11-22T12:10:00Z");
    const fetched = (fetchedAt: string | null): string => GitWorkspaceRow.fetchedOf(summaryOf(GitFixtures.status([], null, { fetchedAt })), now);
    const row: GitWorkspaceRow = new GitWorkspaceRow(folder, signal(summaryOf(GitFixtures.status([], null, { fetchedAt: null }))), signal(undefined), signal(false));

    expect([fetched("2026-11-22T12:08:00Z"), fetched("2026-11-22T12:09:30Z"), fetched(null), row.fetched()]).toEqual(["2 min ago", "now", "Never", "Never"]);
    expect([GitWorkspaceRow.fetchedOf(null, now), GitWorkspaceRow.fetchedOf(summaryOf(null), now)]).toEqual(["", ""]);
  });

  it("shows the current branch's pull request in any state, in the host's own word when it gives one, an open one that waits for its reviews as Review, with the worst of its checks, opening it from the row", () => {
    const pull = (label: string, passed: number, failing: number, pending: number): GitPullRequestRow =>
      new GitPullRequestRow(label, label, `Change ${label}`, `https://github.com/example-owner/site/pull/${label.slice(1)}`, false, 1, passed, failing, pending, "feature/graph");
    const cells = (shown: GitBranchPullRequest): readonly string[] => {
      const row: GitWorkspaceRow = new GitWorkspaceRow(folder, signal(summaryOf(GitFixtures.status([], null, { branch: "feature/graph" }))), signal(shown), signal(false));
      return [row.pullRequestText(), row.checks(), row.checksTone(), row.pullRequest()?.url ?? ""];
    };

    expect([
      cells(GitBranchPullRequest.of(pull("#214", 3, 0, 0), GitPullRequestState.Open, false)), cells(GitBranchPullRequest.of(pull("#533", 1, 0, 2), GitPullRequestState.Open, true)),
      cells(GitBranchPullRequest.of(pull("#1046", 0, 0, 0), GitPullRequestState.Draft, true)), cells(GitBranchPullRequest.of(pull("#22", 3, 1, 2), GitPullRequestState.Merged, false)),
      cells(GitBranchPullRequest.of(pull("#9", 0, 0, 0), GitPullRequestState.Closed, false)),
      cells(GitBranchPullRequest.of(pull("!22", 3, 0, 0), GitPullRequestState.Merged, false, "Completed")),
      cells(GitBranchPullRequest.of(pull("!9", 0, 0, 0), GitPullRequestState.Closed, false, "Abandoned")),
      cells(GitBranchPullRequest.of(pull("!533", 1, 0, 2), GitPullRequestState.Open, true, "Active"))
    ]).toEqual([
      ["#214 open", "Passing", "ok", "https://github.com/example-owner/site/pull/214"], ["Review #533", "Running", "pending", "https://github.com/example-owner/site/pull/533"],
      ["#1046 draft", "None", "none", "https://github.com/example-owner/site/pull/1046"], ["#22 merged", "Failing", "failed", "https://github.com/example-owner/site/pull/22"],
      ["#9 closed", "None", "none", "https://github.com/example-owner/site/pull/9"],
      ["!22 completed", "Passing", "ok", "https://github.com/example-owner/site/pull/22"], ["!9 abandoned", "None", "none", "https://github.com/example-owner/site/pull/9"],
      ["Review !533", "Running", "pending", "https://github.com/example-owner/site/pull/533"]
    ]);
  });

  it("shows the open pull request the branch's is stacked on, the one in the list whose head is its base, and none without a base, a match or a list", () => {
    const pullOf = (label: string, head: string, base: string | null): GitPullRequestRow =>
      new GitPullRequestRow(label.slice(1), label, `Change ${label}`, `https://github.com/example-owner/site/pull/${label.slice(1)}`, false, 0, 0, 0, 0, head, base);
    const bottom: GitPullRequestRow = pullOf("#214", "feature/graph-base", "main");
    const top: GitPullRequestRow = pullOf("#215", "feature/graph", "feature/graph-base");
    const loose: GitPullRequestRow = pullOf("#216", "feature/graph", null);
    const own: GitPullRequestRow = pullOf("#217", "feature/graph", "feature/graph");
    const cells = (shown: GitPullRequestRow, list: GitPullRequestList | null | undefined): readonly unknown[] => {
      const row: GitWorkspaceRow = new GitWorkspaceRow(folder, signal(summaryOf(GitFixtures.status([], null, { branch: "feature/graph" }))),
        signal(GitBranchPullRequest.of(shown, GitPullRequestState.Open, false)), signal(false), signal(list));
      return [row.pullRequestText(), row.stackedOn()?.label ?? null, row.openList() === list];
    };

    expect([cells(top, GitPullRequestList.ready([top, bottom])), cells(top, GitPullRequestList.ready([top])), cells(top, null), cells(top, undefined),
      cells(loose, GitPullRequestList.ready([loose, bottom])), cells(own, GitPullRequestList.ready([own]))]).toEqual([["#215 open · on #214", "#214", true],
      ["#215 open", null, true], ["#215 open", null, true], ["#215 open", null, true], ["#216 open", null, true], ["#217 open", null, true]]);
    expect(new GitWorkspaceRow(folder, signal(null), signal(undefined), signal(false)).openList()).toBeUndefined();
  });

  it("counts the repository's open pull requests and the ones failing their checks in words, a + when the host has more, and nothing until the host lists them", () => {
    const pullOf = (n: number, failing: number): GitPullRequestRow =>
      new GitPullRequestRow(`${n}`, `#${n}`, `Change ${n}`, `https://github.com/example-owner/site/pull/${n}`, false, 0, 0, failing, 0, `change-${n}`);
    const cells = (opened: GitPullRequestList | null | undefined): readonly string[] => {
      const row: GitWorkspaceRow = new GitWorkspaceRow(folder, signal(null), signal(undefined), signal(false), signal(undefined), signal(opened));
      return [row.open(), row.openTitle()];
    };

    expect([
      cells(GitPullRequestList.ready([pullOf(1, 0), pullOf(2, 2), pullOf(3, 1)])), cells(GitPullRequestList.ready([pullOf(1, 0)])),
      cells(GitPullRequestList.ready([pullOf(1, 1), pullOf(2, 0)], true)), cells(GitPullRequestList.ready([])),
      cells(GitPullRequestList.reading([pullOf(1, 0)])), cells(GitPullRequestList.signedOut()), cells(GitPullRequestList.failed("offline")), cells(null), cells(undefined)
    ]).toEqual([
      ["3 · 2 failing", "3 open pull requests, 2 with failing checks"], ["1", "1 open pull request"], ["2+ · 1 failing", "2+ open pull requests, 1 with failing checks"],
      ["None", "0 open pull requests"], ["", ""], ["", ""], ["", ""], ["", ""], ["", ""]
    ]);
  });

  it("shows a branch without a pull request as None with its head commit's checks, and keeps the last answer's checks while the host reads again", () => {
    const cells = (shown: GitBranchPullRequest): readonly string[] => {
      const row: GitWorkspaceRow = new GitWorkspaceRow(folder, signal(summaryOf(GitFixtures.status([], null, { branch: "main" }))), signal(shown), signal(false));
      return [row.pullRequestText(), row.checks(), row.checksTone(), row.pullRequest()?.label ?? ""];
    };
    const open: GitBranchPullRequest = GitBranchPullRequest.of(new GitPullRequestRow("7", "#7", "Fix", "https://github.com/example-owner/site/pull/7", false, 0, 1, 0, 0, "main"),
      GitPullRequestState.Open, false);

    expect([cells(GitBranchPullRequest.none(2, 0, 1)), cells(GitBranchPullRequest.none(0, 0, 0)), cells(GitBranchPullRequest.reading(GitBranchPullRequest.none(0, 1, 0))),
      cells(GitBranchPullRequest.reading(open)), cells(GitBranchPullRequest.reading(GitBranchPullRequest.none(0, 0, 0))), cells(GitBranchPullRequest.reading())])
      .toEqual([["None", "Running", "pending", ""], ["None", "None", "none", ""], ["", "Failing", "failed", ""], ["#7 open", "Passing", "ok", "#7"], ["", "", "", ""],
        ["", "", "", ""]]);
  });

  it("says when no host reads the pull requests, the host needs a sign-in or failed, and shows nothing before a read or an answer", () => {
    const main: GitRepositorySummary = summaryOf(GitFixtures.status([], null, { branch: "main" }));
    const text = (summary: GitRepositorySummary | null, shown: GitBranchPullRequest | null | undefined): string => GitWorkspaceRow.pullRequestTextOf(summary, shown);
    const checks = (summary: GitRepositorySummary | null, shown: GitBranchPullRequest | null | undefined): string =>
      GitWorkspaceRow.checksOf(GitWorkspaceRow.countedOf(summary, shown));

    expect([text(null, undefined), text(summaryOf(null), undefined), text(main, undefined), text(main, null), text(main, GitBranchPullRequest.reading()),
      text(main, GitBranchPullRequest.signedOut()), text(main, GitBranchPullRequest.failed("No answer."))])
      .toEqual(["", "", "None", "", "", "Sign in", "Unavailable"]);
    expect([checks(null, GitBranchPullRequest.none(1, 0, 0)), checks(summaryOf(null), GitBranchPullRequest.none(1, 0, 0)), checks(main, undefined), checks(main, null),
      checks(main, GitBranchPullRequest.signedOut()), checks(main, GitBranchPullRequest.failed(null))]).toEqual(["", "", "", "", "", ""]);
  });

  it("counts the repositories shown, with how many are selected, and the ones a removal takes", () => {
    expect([Resources.formatRepositoryCount(1, 0), Resources.formatRepositoryCount(12, 3), Resources.formatRemoveRepositories(2)])
      .toEqual(["1 repository", "12 repositories · 3 selected", "Remove 2"]);
  });

  it("puts a row in the views of a branch behind its upstream, uncommitted changes, an open pull request waiting for review and agents at work", () => {
    const pull: GitPullRequestRow = new GitPullRequestRow("5", "#5", "Fix", "https://github.com/example-owner/site/pull/5", false, 0, 0, 0, 0, "main");
    const views = (status: GitStatus | null, shown: GitBranchPullRequest | null | undefined, hasAgentsAtWork: boolean): readonly GitWorkspaceView[] =>
      [...new GitWorkspaceRow(folder, signal(Object.isNull(status) ? null : summaryOf(status)), signal(shown), signal(hasAgentsAtWork)).views()];
    const behind: GitStatus = GitFixtures.status([modified("a.ts")], new StatusUpstream("origin/main", 1, 2, false), { branch: "main" });
    const clean: GitStatus = GitFixtures.status([], new StatusUpstream("origin/main", 3, 0, false), { branch: "main" });
    const cut: GitStatus = GitFixtures.status([], null, { branch: "main", truncated: true });

    expect([
      views(behind, GitBranchPullRequest.of(pull, GitPullRequestState.Open, true), true), views(clean, GitBranchPullRequest.of(pull, GitPullRequestState.Draft, true), false),
      views(clean, GitBranchPullRequest.of(pull, GitPullRequestState.Open, false), false), views(cut, undefined, false), views(null, null, true),
      [...GitWorkspaceRow.viewsOf(summaryOf(null), GitBranchPullRequest.of(pull, GitPullRequestState.Open, true), false)]
    ]).toEqual([
      [GitWorkspaceView.AgentsAtWork, GitWorkspaceView.Behind, GitWorkspaceView.Changed, GitWorkspaceView.WaitingForReview], [], [], [GitWorkspaceView.Changed],
      [GitWorkspaceView.AgentsAtWork], []
    ]);
    expect(Object.values(GitWorkspaceView)).toEqual(["Behind", "Changed", "WaitingForReview", "AgentsAtWork"]);
  });

  it("says where the host's read of the branch stands, or nothing while no host reads it or before it answers", () => {
    const state = (shown: GitBranchPullRequest | null | undefined): GitPullRequestsState | null =>
      new GitWorkspaceRow(folder, signal(null), signal(shown), signal(false)).hostState();

    expect([state(undefined), state(null), state(GitBranchPullRequest.signedOut()), state(GitBranchPullRequest.none(0, 0, 0))])
      .toEqual([null, null, GitPullRequestsState.SignedOut, GitPullRequestsState.Ready]);
  });
});
