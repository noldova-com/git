/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed, type Signal, signal } from "@angular/core";

import { GitPullRequestState } from "../enums/git-pull-request-state.ts";
import { GitPullRequestsState } from "../enums/git-pull-requests-state.ts";
import { GitWorkspaceView } from "../enums/git-workspace-view.ts";
import { Resources } from "../../resources.ts";
import { CommitLabels } from "../services/commit-labels.ts";
import type { GitBranchPullRequest } from "./git-branch-pull-request.ts";
import type { GitPullRequestList } from "./git-pull-request-list.ts";
import type { GitPullRequestRow } from "./git-pull-request-row.ts";
import type { GitRepositorySummary } from "./git-repository-summary.ts";

/** One repository's row on a workspace's page, with the texts its cells show. */
export class GitWorkspaceRow {
  public readonly folder: string;
  public readonly name: string;
  public readonly summary: Signal<GitRepositorySummary | null>;
  public readonly branch: Signal<string>;
  public readonly sync: Signal<string>;
  public readonly changes: Signal<string>;
  /** How long ago the repository last fetched, as of its last read. */
  public readonly fetched: Signal<string>;
  /** Why the last read or fetch failed, which the row shows in place of its branch and sync. */
  public readonly failure: Signal<string | null>;
  /** How many files have conflicts, as of the last read. */
  public readonly conflicts: Signal<number>;
  public readonly hasConflicts: Signal<boolean>;
  /** The current branch's pull request, which the row's Pull request cell opens, or null. */
  public readonly pullRequest: Signal<GitPullRequestRow | null>;
  /**
   * The open list the page finds stacks in, from the host that claims the repository's remote: its stack list or its open list, undefined when it
   * has neither, null before an answer. Only stacks read it.
   */
  public readonly openList: Signal<GitPullRequestList | null | undefined>;
  /** The open pull request the branch's is stacked on, its base being that one's head, or null. */
  public readonly stackedOn: Signal<GitPullRequestRow | null>;
  /** The Pull request cell: the branch's pull request and the one it is stacked on, that it has none, or why the host can't tell. */
  public readonly pullRequestText: Signal<string>;
  /** The Checks cell: the worst of the branch's pull request's checks, or of its head commit's without one. */
  public readonly checks: Signal<string>;
  /** The Checks dot's kind: failed, pending, ok or none; empty while the host has no answer. */
  public readonly checksTone: Signal<string>;
  /** How many of the checks the Checks cell counts failed: none while the host has no answer. */
  public readonly failing: Signal<number>;
  /** Where the host's read of the branch's pull request stands, or null while no host reads it or before it answers. */
  public readonly hostState: Signal<GitPullRequestsState | null>;
  /** The side panel's views that show the row. */
  public readonly views: Signal<ReadonlySet<GitWorkspaceView>>;

  /**
   * @param pullRequest The current branch's pull request: undefined while no host reads it for the repository's remote, null before the host answers.
   * @param hasAgentsAtWork Whether an agent works in the repository or waits for the person.
   * @param openList The host's list of the repository's open pull requests to find stacks in, when the page reads one; undefined by default.
   */
  public constructor(folder: string, summary: Signal<GitRepositorySummary | null>, pullRequest: Signal<GitBranchPullRequest | null | undefined>,
    hasAgentsAtWork: Signal<boolean>, openList: Signal<GitPullRequestList | null | undefined> = signal(undefined)) {
    this.folder = folder;
    this.name = Resources.formatHistoryTitle(folder);
    this.summary = summary;
    this.failure = computed(() => summary()?.failure ?? null);
    this.conflicts = computed(() => summary()?.conflicts ?? 0);
    this.hasConflicts = computed(() => this.conflicts() > 0);
    this.branch = computed(() => GitWorkspaceRow.branchOf(summary()));
    this.sync = computed(() => GitWorkspaceRow.syncOf(summary()));
    this.changes = computed(() => GitWorkspaceRow.changesOf(summary()));
    this.fetched = computed(() => GitWorkspaceRow.fetchedOf(summary(), new Date()));
    this.pullRequest = computed(() => pullRequest()?.pullRequest ?? null);
    this.openList = openList;
    this.stackedOn = computed(() => GitWorkspaceRow.stackedOnOf(this.pullRequest(), openList()));
    this.pullRequestText = computed(() => {
      const text: string = GitWorkspaceRow.pullRequestTextOf(summary(), pullRequest());
      const under: GitPullRequestRow | null = this.stackedOn();
      return under === null ? text : Resources.formatStackedOn(text, under.label);
    });
    const counted: Signal<GitBranchPullRequest | null> = computed(() => GitWorkspaceRow.countedOf(summary(), pullRequest()));
    this.checks = computed(() => GitWorkspaceRow.checksOf(counted()));
    this.checksTone = computed(() => GitWorkspaceRow.checksToneOf(counted()));
    this.failing = computed(() => counted()?.failing ?? 0);
    this.hostState = computed(() => pullRequest()?.state ?? null);
    this.views = computed(() => GitWorkspaceRow.viewsOf(summary(), pullRequest(), hasAgentsAtWork()));
  }

  /** The views that show a repository: behind, changed and waiting for review once a read shows it, and agents at work whenever one is. */
  public static viewsOf(summary: GitRepositorySummary | null, shown: GitBranchPullRequest | null | undefined, hasAgentsAtWork: boolean): ReadonlySet<GitWorkspaceView> {
    const views: Set<GitWorkspaceView> = new Set();
    if (hasAgentsAtWork)
      views.add(GitWorkspaceView.AgentsAtWork);
    if (summary === null || summary.isUnread)
      return views;
    if (summary.behind > 0)
      views.add(GitWorkspaceView.Behind);
    if (summary.files > 0 || summary.isTruncated)
      views.add(GitWorkspaceView.Changed);
    if (shown?.pullRequestState === GitPullRequestState.Open && shown.isWaitingForReview)
      views.add(GitWorkspaceView.WaitingForReview);
    return views;
  }

  /** The other open pull request in the list whose head is the pull request's base, or null; a host that didn't say the base stacks nothing. */
  public static stackedOnOf(row: GitPullRequestRow | null, list: GitPullRequestList | null | undefined): GitPullRequestRow | null {
    if (row === null || row.baseBranch === null || list === null || list === undefined)
      return null;
    return list.rows.find(t => t.key !== row.key && t.headBranch === row.baseBranch) ?? null;
  }

  /**
   * The branch's pull request, such as "#214 open", "#1046 draft", "Review #533" or "#22 merged"; None when no host reads the repository's
   * pull requests or the branch has none; that the host needs a sign-in or can't answer; nothing until a read shows the repository or while the
   * host reads.
   */
  public static pullRequestTextOf(summary: GitRepositorySummary | null, shown: GitBranchPullRequest | null | undefined): string {
    if (summary === null || summary.isUnread)
      return "";
    if (shown === undefined)
      return Resources.noPullRequest;
    if (shown !== null && shown.pullRequest !== null && shown.pullRequestState !== null)
      return Resources.formatWorkspacePullRequest(shown.pullRequest.label, shown.pullRequestState, shown.isWaitingForReview);
    switch (shown?.state) {
      case GitPullRequestsState.Ready:
        return Resources.noPullRequest;
      case GitPullRequestsState.SignedOut:
        return Resources.pullRequestSignedOut;
      case GitPullRequestsState.Failed:
        return Resources.pullRequestUnavailable;
      default:
        return "";
    }
  }

  /** The answer whose checks the row shows: a read one, or one that still reads with a pull request or checks from the last; else null. */
  public static countedOf(summary: GitRepositorySummary | null, shown: GitBranchPullRequest | null | undefined): GitBranchPullRequest | null {
    if (summary === null || summary.isUnread || shown === undefined || shown === null)
      return null;
    if (shown.state === GitPullRequestsState.Ready)
      return shown;
    return shown.state === GitPullRequestsState.Reading && (shown.pullRequest !== null || shown.passed + shown.failing + shown.pending > 0) ? shown : null;
  }

  /** Failing when any check failed, else Running while one runs or waits, else Passing when one passed, else None; nothing without an answer. */
  public static checksOf(row: GitBranchPullRequest | null): string {
    if (row === null)
      return "";
    if (row.failing > 0)
      return Resources.checksFailing;
    if (row.pending > 0)
      return Resources.checksRunning;
    return row.passed > 0 ? Resources.checksPassing : Resources.noChecks;
  }

  public static checksToneOf(row: GitBranchPullRequest | null): string {
    if (row === null)
      return "";
    if (row.failing > 0)
      return "failed";
    if (row.pending > 0)
      return "pending";
    return row.passed > 0 ? "ok" : "none";
  }

  /** The branch's name, where a detached head points, or that the repository has no commits; nothing until a read shows it. */
  public static branchOf(summary: GitRepositorySummary | null): string {
    if (summary === null || summary.isUnread)
      return "";
    if (summary.branch !== null)
      return summary.branch;
    return summary.head === null ? Resources.noCommitsYet : Resources.formatDetachedAt(summary.head.slice(0, 7));
  }

  /** How far the branch is from its upstream, or that it has none or it's gone; nothing until a read shows it. */
  public static syncOf(summary: GitRepositorySummary | null): string {
    if (summary === null || summary.isUnread)
      return "";
    if (summary.upstream === null)
      return Resources.noUpstreamShort;
    return summary.gone ? Resources.upstreamGone : Resources.formatSync(summary.ahead, summary.behind);
  }

  /** How long ago it last fetched, or that it never has; nothing until a read shows it. */
  public static fetchedOf(summary: GitRepositorySummary | null, now: Date): string {
    if (summary === null || summary.isUnread)
      return "";
    return summary.fetchedAt === null ? Resources.neverFetched : CommitLabels.ageOf(summary.fetchedAt, now);
  }

  /** Its conflicts, else how many files changed, or that a fetch is going; nothing until a read shows it. */
  public static changesOf(summary: GitRepositorySummary | null): string {
    if (summary === null)
      return "";
    if (summary.isFetching)
      return Resources.fetching;
    if (summary.isUnread)
      return "";
    return summary.conflicts > 0 ? Resources.formatConflicts(summary.conflicts) : Resources.formatChangedFileCount(summary.files, summary.isTruncated);
  }
}
