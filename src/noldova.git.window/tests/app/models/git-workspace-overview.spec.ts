/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import { ConflictKind, FileState, GitRemote, type GitStatus, RemoteTransport, StatusUpstream } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { GitAgentState } from "../../../src/app/enums/git-agent-state.ts";
import { GitPullRequestState } from "../../../src/app/enums/git-pull-request-state.ts";
import type { IGitAgents } from "../../../src/app/interfaces/i-git-agents.ts";
import { GitAgentRow } from "../../../src/app/models/git-agent-row.ts";
import { GitBranchPullRequest } from "../../../src/app/models/git-branch-pull-request.ts";
import { GitBulkOutcome } from "../../../src/app/models/git-bulk-outcome.ts";
import { GitBulkResult } from "../../../src/app/models/git-bulk-result.ts";
import { GitPullRequestList } from "../../../src/app/models/git-pull-request-list.ts";
import { GitPullRequestRow } from "../../../src/app/models/git-pull-request-row.ts";
import type { GitPullRequestStack } from "../../../src/app/models/git-pull-request-stack.ts";
import { GitRepositorySummary } from "../../../src/app/models/git-repository-summary.ts";
import { GitSharedBranch } from "../../../src/app/models/git-shared-branch.ts";
import { GitWorkspaceOverview } from "../../../src/app/models/git-workspace-overview.ts";
import { GitWorkspaceRow } from "../../../src/app/models/git-workspace-row.ts";
import { GitWorkspaceRun } from "../../../src/app/models/git-workspace-run.ts";
import { GitFixtures } from "../../fixtures/git-fixtures.fixture.ts";

describe("GitWorkspaceOverview", () => {
  const remote: GitRemote = new GitRemote("origin", "github.com", "example-owner/git", RemoteTransport.Https);
  const pull = (failing: number): GitBranchPullRequest => GitBranchPullRequest.of(new GitPullRequestRow("1", "#1", "Change 1", "https://github.com/example-owner/git/pull/1",
    false, 0, 1, failing, 0, "feature/kit"), GitPullRequestState.Open, false);
  const none: GitBranchPullRequest = GitBranchPullRequest.none(0, 0, 0);
  const rowOf = (folder: string, branch: string | null, upstream: StatusUpstream | null = null, pullRequest: GitBranchPullRequest = none, conflicts: number = 0): GitWorkspaceRow => {
    const status: GitStatus = GitFixtures.status(Array.from({ length: conflicts }, (_, i) =>
      GitFixtures.entry(`c${i}.ts`, FileState.Unmodified, FileState.Unmodified, null, ConflictKind.BothModified)), upstream, { branch, remote });
    return new GitWorkspaceRow(folder, signal(new GitRepositorySummary(folder, status, false, null)), signal(pullRequest), signal(false));
  };
  const unread = (folder: string): GitWorkspaceRow => new GitWorkspaceRow(folder, signal(null), signal(none), signal(false));
  const namesOf = (rows: readonly GitWorkspaceRow[]): readonly string[] => rows.map(t => t.name);

  it("takes the branch the most repositories have out as one change, at least two with a pull request among them, the first of two as wide", () => {
    const kit: readonly GitWorkspaceRow[] = [rowOf("/work/ui", "feature/kit", null, pull(0)), rowOf("/work/git", "feature/kit"), rowOf("/work/term", "feature/kit")];
    const mains: readonly GitWorkspaceRow[] = [rowOf("/work/a", "main"), rowOf("/work/b", "main"), rowOf("/work/c", "main"), rowOf("/work/d", "main")];
    const pair: readonly GitWorkspaceRow[] = [rowOf("/work/x", "feature/x", null, pull(0)), rowOf("/work/y", "feature/x")];
    const other: readonly GitWorkspaceRow[] = [rowOf("/work/p", "feature/p", null, pull(0)), rowOf("/work/q", "feature/p")];
    const loose: readonly GitWorkspaceRow[] = [rowOf("/work/n", null), unread("/work/m"), rowOf("/work/o", "feature/o", null, pull(0))];

    const shared: GitSharedBranch | null = GitWorkspaceOverview.sharedBranchOf([...mains, ...pair, ...kit, ...loose]);

    expect([shared?.branch, namesOf(shared?.rows ?? [])]).toEqual(["feature/kit", ["ui", "git", "term"]]);
    expect(GitWorkspaceOverview.sharedBranchOf([...pair, ...other])?.branch).toBe("feature/x");
    expect(GitWorkspaceOverview.sharedBranchOf([...mains, ...loose])).toBeNull();
  });

  it("finds each listed repository's stacks once, bottom first, each pull request in the first that reaches it, and none in a loop", () => {
    const pullOf = (number: number, head: string, base: string | null): GitPullRequestRow =>
      new GitPullRequestRow(String(number), `#${number}`, `Change ${number}`, `https://github.com/example-owner/git/pull/${number}`, false, 0, 0, 0, 0, head, base);
    const listed = (folder: string, list: GitPullRequestList | null | undefined): GitWorkspaceRow =>
      new GitWorkspaceRow(folder, signal(new GitRepositorySummary(folder, GitFixtures.status([], null, { branch: "main", remote }), false, null)), signal(none),
        signal(false), signal(list));
    const git: GitPullRequestList = GitPullRequestList.ready([pullOf(3, "c", "b"), pullOf(1, "a", "main"), pullOf(2, "b", "a"), pullOf(4, "d", "a"), pullOf(5, "x", "main"),
      pullOf(7, "z", "y"), pullOf(6, "y", "gone"), pullOf(8, "p", "q"), pullOf(9, "q", "p"), pullOf(10, "n", null)]);
    const ui: GitPullRequestList = GitPullRequestList.ready([pullOf(11, "k", "main"), pullOf(12, "l", "k")]);

    const stacks: readonly GitPullRequestStack[] = GitWorkspaceOverview.stacksOf([listed("/work/none", undefined), listed("/work/git", git), listed("/work/git-blame", git), listed("/work/wait", null),
      listed("/work/ui", ui)]);

    expect(stacks.map(t => [t.row.name, t.bottom.label, t.pullRequests.map(u => u.label)])).toEqual([["git", "#1", ["#1", "#2", "#4", "#3"]], ["git", "#6", ["#6", "#7"]],
      ["ui", "#11", ["#11", "#12"]]]);
    expect(GitWorkspaceOverview.stacksOf([listed("/work/git", GitPullRequestList.ready([pullOf(1, "a", "main"), pullOf(5, "x", "main")]))])).toEqual([]);
  });

  it("finds the repositories with conflicts, failing checks, and a branch only behind its upstream", () => {
    const behind: StatusUpstream = new StatusUpstream("origin/main", 0, 2, false);
    const rows: readonly GitWorkspaceRow[] = [rowOf("/work/a", "main", null, none, 2), rowOf("/work/b", "main", null, pull(1)), rowOf("/work/c", "main", behind),
      rowOf("/work/d", "main", new StatusUpstream("origin/main", 1, 2, false)), rowOf("/work/e", "main", new StatusUpstream("origin/main", 0, 0, true)),
      rowOf("/work/f", "main", new StatusUpstream("origin/main", 0, 0, false)), rowOf("/work/g", "main"), unread("/work/h")];

    expect([namesOf(GitWorkspaceOverview.conflictedOf(rows)), namesOf(GitWorkspaceOverview.failingOf(rows)), namesOf(GitWorkspaceOverview.behindOf(rows))])
      .toEqual([["a"], ["b"], ["c"]]);
    expect([rows[0]?.conflicts(), rows[1]?.failing(), rows[7]?.failing()]).toEqual([2, 1, 0]);
  });

  it("splits the agents' runs into the ones waiting for the person and the ones working, and tells a run in its own worktree", () => {
    const provider: IGitAgents = { listFor: () => signal([]), open: () => undefined };
    const run = (key: string, state: GitAgentState, worktree: string): GitWorkspaceRun => new GitWorkspaceRun("/work/git", "git", provider, new GitAgentRow(key, key, state, worktree));
    const runs: readonly GitWorkspaceRun[] = [run("a", GitAgentState.Working, "/work/git"), run("b", GitAgentState.WaitingForYou, "/work/git-b"),
      run("c", GitAgentState.Done, "/work/git"), run("d", GitAgentState.Working, "/work/git-d")];

    expect([GitWorkspaceOverview.waitingOf(runs).map(t => t.row.key), GitWorkspaceOverview.workingOf(runs).map(t => t.row.key)]).toEqual([["b"], ["a", "d"]]);
    expect(runs.map(t => t.hasOwnWorktree)).toEqual([false, true, false, true]);
  });

  it("names what a push would push in each repository, without an upstream for one that has none or isn't read, and what a pull would pull", () => {
    const upstream: StatusUpstream = new StatusUpstream("origin/feature/kit", 1, 0, false);
    const shared: GitSharedBranch = new GitSharedBranch("feature/kit", [rowOf("/work/ui", "feature/kit", upstream), rowOf("/work/git", "feature/kit"), unread("/work/term")]);

    expect(GitWorkspaceOverview.pushTargetsOf(shared).map(t => [t.folder, t.repository, t.branch, t.upstream, GitWorkspaceOverview.placeOf(t.remote)]))
      .toEqual([["/work/ui", "ui", "feature/kit", "origin/feature/kit", "github.com/example-owner/git"], ["/work/git", "git", "feature/kit", null, "github.com/example-owner/git"],
        ["/work/term", "term", "feature/kit", null, null]]);
    expect(GitWorkspaceOverview.pullTargetsOf([rowOf("/work/a", "main")]).map(t => [t.folder, t.repository, t.branch, t.upstream, t.remote])).toEqual([["/work/a", "a", "main", null, null]]);
  });

  it("pushes to the upstream only when it is on the branch's remote, as a push does, and names none otherwise", () => {
    const local: GitWorkspaceRow = rowOf("/work/local", "feature/kit", new StatusUpstream("main", 1, 0, false));

    expect([GitWorkspaceOverview.pushUpstreamOf("origin/feature/kit", remote), GitWorkspaceOverview.pushUpstreamOf("main", remote),
      GitWorkspaceOverview.pushUpstreamOf("upstream/feature/kit", remote), GitWorkspaceOverview.pushUpstreamOf("origin/feature/kit", null),
      GitWorkspaceOverview.pushUpstreamOf(null, remote)]).toEqual(["origin/feature/kit", null, null, null, null]);
    expect(GitWorkspaceOverview.pushTargetsOf(new GitSharedBranch("feature/kit", [local])).map(t => t.upstream)).toEqual([null]);
  });

  it("takes two reads for the same remote only when its name, host, path and transport all match, or neither has one", () => {
    const changed: readonly GitRemote[] = [new GitRemote("fork", "github.com", "example-owner/git", RemoteTransport.Https),
      new GitRemote("origin", "gitlab.com", "example-owner/git", RemoteTransport.Https), new GitRemote("origin", "github.com", "example-owner/site", RemoteTransport.Https),
      new GitRemote("origin", "github.com", "example-owner/git", RemoteTransport.Ssh)];

    expect([GitWorkspaceOverview.isSameRemote(new GitRemote("origin", "github.com", "example-owner/git", RemoteTransport.Https), remote),
      GitWorkspaceOverview.isSameRemote(null, null), GitWorkspaceOverview.isSameRemote(remote, null), GitWorkspaceOverview.isSameRemote(null, remote)])
      .toEqual([true, true, false, false]);
    expect(changed.map(t => GitWorkspaceOverview.isSameRemote(t, remote))).toEqual([false, false, false, false]);
  });

  it("names where a remote is only when the status gives its host and path", () => {
    expect([GitWorkspaceOverview.placeOf(remote), GitWorkspaceOverview.placeOf(null), GitWorkspaceOverview.placeOf(new GitRemote("origin", null, "a/b", RemoteTransport.Ssh)),
      GitWorkspaceOverview.placeOf(new GitRemote("origin", "example.com", null, RemoteTransport.Ssh))]).toEqual(["github.com/example-owner/git", null, null, null]);
  });

  it("tells how a bulk write ended, a line for the ones written, then each skipped and each failed", () => {
    const skipped: readonly GitBulkOutcome[] = [new GitBulkOutcome("git", "it has no upstream")];
    const failed: readonly GitBulkOutcome[] = [new GitBulkOutcome("terminal", "The remote refused it.")];

    expect(GitWorkspaceOverview.resultLinesOf("Pushed", new GitBulkResult(["ui", "context", "desktop"], skipped, failed)))
      .toEqual(["Pushed ui, context and desktop.", "Skipped git: it has no upstream.", "terminal failed: The remote refused it."]);
    expect(GitWorkspaceOverview.resultLinesOf("Pulled", new GitBulkResult(["ui"], [], []))).toEqual(["Pulled ui."]);
    expect(GitWorkspaceOverview.resultLinesOf("Pulled", new GitBulkResult([], skipped, []))).toEqual(["Skipped git: it has no upstream."]);
  });
});
